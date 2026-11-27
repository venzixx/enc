import { ApplicationCommandOptionType, GuildMember, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { PermsHelper } from '../../utils/PermsHelper';

export default class PermsCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'perms',
            aliases: ['permissions', 'userperms', 'encperms', 'ep', 'fakeperms', 'fp'],
            description: {
                content: 'View effective Discord and Enc Permissions (EO, TA, Whitelists) for a member.',
                usage: 'perms [user] [channel]',
                examples: ['perms', 'perms @member', 'perms @member #channel', 'encperms @member']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to inspect permissions for.',
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: 'channel',
                    description: 'The channel to evaluate permissions in (optional).',
                    type: ApplicationCommandOptionType.Channel,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) {
            return await ctx.replyV2({
                description: 'This command can only be used in a server.',
                isAlert: true
            });
        }

        const prefixInvoked = (ctx.message?.content?.split(' ')[0] || '').toLowerCase();
        const isEncPerms = prefixInvoked.includes('encperm') ||
            prefixInvoked.endsWith('ep') ||
            prefixInvoked.includes('fakeperm') ||
            prefixInvoked.endsWith('fp') ||
            (ctx.isInteraction && ctx.interaction?.isChatInputCommand() && (ctx.interaction.commandName === 'encperms' || ctx.interaction.commandName === 'fakeperms'));

        let targetMember: GuildMember | null = null;
        let targetChannel: any = ctx.channel;

        if (ctx.isInteraction) {
            targetMember = ctx.options.getMember('user') || ctx.member;
            const ch = ctx.options.getChannel('channel');
            if (ch) targetChannel = ch;
        } else {
            if (args[0]) {
                const channelId = args[0].replace(/[<#>]/g, '');
                const ch = ctx.guild.channels.cache.get(channelId);
                if (ch) {
                    targetChannel = ch;
                    if (args[1]) {
                        targetMember = await Resolver.resolveMember(ctx, args[1]);
                    } else {
                        targetMember = ctx.member;
                    }
                } else {
                    targetMember = await Resolver.resolveMember(ctx, args[0]);
                    if (args[1]) {
                        const ch2Id = args[1].replace(/[<#>]/g, '');
                        const ch2 = ctx.guild.channels.cache.get(ch2Id);
                        if (ch2) targetChannel = ch2;
                    }
                }
            }
            if (!targetMember) {
                targetMember = ctx.member;
            }
        }

        if (!targetMember) {
            return await ctx.replyV2({
                description: 'Could not find that member in this server.',
                isAlert: true
            });
        }

        const authorId = ctx.author?.id || ctx.member?.id || '';
        const payload = isEncPerms
            ? await PermsHelper.buildEncPermsPayload(client, ctx.guild, targetMember, authorId)
            : PermsHelper.buildDiscordPermsPayload(targetChannel, targetMember, authorId);

        if (ctx.message) {
            return await ctx.message.reply({
                ...payload,
                allowedMentions: { repliedUser: false }
            });
        }

        return await ctx.sendMessage(payload);
    }
}
