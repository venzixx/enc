import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Eping extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'eping',
            description: {
                content: 'Ghost ping @everyone with zero trace.',
                usage: 'eping',
                examples: ['eping']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.MentionEveryone],
                client: [PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ManageMessages]
            }
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
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

        try {
            const msg = await (ctx.channel as any).send({
                content: '@everyone',
                allowedMentions: { parse: ['everyone'] }
            });
            await msg.delete().catch(() => {});

            if (ctx.interaction) {
                return await ctx.editReply({ content: `${client.emoji.ghost_ping} Ghost ping sent with zero trace.` });
            }
        } catch (e: any) {
            if (ctx.interaction) {
                return await ctx.editReply({ content: `${client.emoji.cross} Failed to send ghost ping. Check bot permissions.` });
            }
        }
    }
}
