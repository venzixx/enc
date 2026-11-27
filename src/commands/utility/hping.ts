import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Hping extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'hping',
            description: {
                content: 'Send a visible @here ping to the channel.',
                usage: 'hping [message]',
                examples: ['hping', 'hping wake up guys']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.MentionEveryone],
                client: [PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ManageMessages]
            },
            options: [
                {
                    name: 'message',
                    description: 'Optional message to attach to the @here ping',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        // Check if member has MentionEveryone or Administrator or is Owner
        const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
        const isBotOwner = (client as any).owners?.includes(ctx.author.id) || ['1189917578768822364', '801458897721884672'].includes(ctx.author.id);
        const hasPerm = ctx.member?.permissions.has(PermissionFlagsBits.MentionEveryone) || 
                        ctx.member?.permissions.has(PermissionFlagsBits.Administrator);

        if (!isGuildOwner && !isBotOwner && !hasPerm) {
            if (ctx.message) {
                await ctx.message.delete().catch(() => {});
            }
            return await ctx.replyV2({
                description: `${client.emoji.cross} You need the **Mention Everyone** or **Administrator** permission to use this command.`,
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
        }

        // Delete user's triggering command message immediately if prefix
        if (ctx.message) {
            await ctx.message.delete().catch(() => {});
        }

        if (ctx.interaction) {
            await ctx.deferReply(true);
        }

        const messageText = ctx.interaction 
            ? (ctx.interaction as any).options?.getString?.('message') 
            : (args && args.length > 0 ? args.join(' ') : null);

        const content = messageText ? `@here ${messageText}` : '@here';

        try {
            await (ctx.channel as any).send({
                content,
                allowedMentions: { parse: ['everyone'] }
            });

            if (ctx.interaction) {
                return await ctx.editReply({ content: `${client.emoji.success} Sent **@here** ping to the channel.` });
            }
        } catch (e: any) {
            if (ctx.interaction) {
                return await ctx.editReply({ content: `${client.emoji.cross} Failed to send @here ping. Check bot permissions.` });
            } else {
                return await ctx.replyV2({
                    description: `${client.emoji.cross} Failed to send **@here** ping. Check bot permissions.`,
                    isAlert: true,
                    color: client.color.red
                }).catch(() => {});
            }
        }
    }
}
