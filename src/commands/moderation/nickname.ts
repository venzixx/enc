import { PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class NicknameCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'nickname',
            aliases: ['nick'],
            description: {
                content: 'Check or force a member\'s nickname.',
                usage: 'nickname <user> [nickname] [force <on/off>]',
                examples: ['nickname @Member', 'nickname @Member cool-name', 'nickname @Member force on']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageNicknames],
                client: [PermissionFlagsBits.ManageNicknames]
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to check/manage',
                    type: 6,
                    required: true
                },
                {
                    name: 'nickname',
                    description: 'The new nickname to set',
                    type: 3,
                    required: false
                },
                {
                    name: 'force',
                    description: 'Force the nickname (on/off)',
                    type: 3,
                    required: false,
                    choices: [
                        { name: 'On', value: 'on' },
                        { name: 'Off', value: 'off' }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (ctx.interaction) await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx, args[0]);
        if (!target) {
            return await ctx.replyV2({
                description: 'Please provide a valid member.',
                borderless: true,
                color: null,
                isAlert: true,
                allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
            });
        }

        let forceArg: string | null = null;
        let newNickname: string | null = null;

        if (ctx.interaction) {
            forceArg = ctx.options.getString('force');
            newNickname = ctx.options.getString('nickname');
        } else {
            // Prefix logic: ,nick @user <optional nickname> force <on/off>
            const fullArgs = args.slice(1).join(' ');
            if (fullArgs.toLowerCase().includes('force on')) {
                forceArg = 'on';
                newNickname = fullArgs.replace(/force on/i, '').trim();
            } else if (fullArgs.toLowerCase().includes('force off')) {
                forceArg = 'off';
                newNickname = fullArgs.replace(/force off/i, '').trim();
            } else {
                newNickname = fullArgs.trim();
            }
        }

        // Clean empty string
        if (newNickname === '') newNickname = null;

        // Interactive confirmation if making changes
        if (newNickname || forceArg) {
            const force = args.includes('--force') || args.includes('-f');
            const actionName = forceArg ? `Force Nickname (${forceArg.toUpperCase()})` : 'Change Nickname';
            const details = newNickname 
                ? `Set nickname to "${newNickname}"${forceArg ? ` (Force: ${forceArg})` : ''}` 
                : `Set force nickname status to "${forceArg}"`;

            const confirmed = await ModConfirmation.ask({
                client,
                ctx,
                actionName,
                targetName: `${target.user.tag} (${target.id})`,
                targetAvatar: target.user.displayAvatarURL(),
                dangerLevel: 'warning',
                details,
                confirmLabel: 'Confirm Nickname',
                confirmEmoji: '✏️',
                force
            });

            if (!confirmed) return;
        }

        // 1. Handle Nickname Change if provided
        if (newNickname) {
            try {
                if (target.roles.highest.position >= (ctx.guild.members.me as GuildMember).roles.highest.position && ctx.guild.ownerId !== ctx.author.id) {
                    return await ctx.replyV2({
                        description: 'I cannot change the nickname of someone with a higher or equal role than me.',
                        borderless: true,
                        color: null,
                        isAlert: true,
                        allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
                    });
                }
                await target.setNickname(newNickname, `Requested by ${ctx.author.tag}`);
            } catch (err: any) {
                return await ctx.replyV2({
                    description: `Failed to change nickname: ${err.message}`,
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
                });
            }
        }

        // 2. Handle Force Status
        if (forceArg === 'on') {
            // Use the NEW nickname if we just set it, otherwise use current
            const finalNick = newNickname || target.nickname || target.user.username;
            
            await client.prisma.forcedNickname.upsert({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } },
                update: { nickname: finalNick },
                create: { guildId: ctx.guild.id, userId: target.id, nickname: finalNick }
            });

            return await ctx.replyV2({
                title: `${client.emoji.success} Nickname Forced`,
                description: `Successfully ${newNickname ? 'updated and ' : ''}forced **${target.user.tag}** (<@${target.id}>)'s nickname to \`${finalNick}\`.`,
                borderless: true,
                color: null,
                allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
            });
        } else if (forceArg === 'off') {
            await client.prisma.forcedNickname.deleteMany({
                where: { guildId: ctx.guild.id, userId: target.id }
            });

            return await ctx.replyV2({
                title: `${client.emoji.success} Force Removed`,
                description: `Successfully ${newNickname ? 'updated nickname and ' : ''}removed force for **${target.user.tag}** (<@${target.id}>).`,
                borderless: true,
                color: null,
                allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
            });
        }

        // 3. If no force arg and no nickname change, just show info
        if (!newNickname && !forceArg) {
            const isForced = await client.prisma.forcedNickname.findUnique({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
            });

            return await ctx.replyV2({
                title: `Nickname Info: ${target.user.tag}`,
                fields: [
                    { name: 'Current Nickname', value: target.nickname || 'None', inline: true },
                    { name: 'Force Status', value: isForced ? `${client.emoji.success} Forced (\`${isForced.nickname}\`)` : `${client.emoji.cross} Not Forced`, inline: true }
                ],
                borderless: true,
                color: null,
                thumbnail: target.user.displayAvatarURL(),
                allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
            });
        } else if (newNickname && !forceArg) {
            return await ctx.replyV2({
                title: `${client.emoji.success} Nickname Updated`,
                description: `Successfully changed nickname for **${target.user.tag}** (<@${target.id}>) to \`${newNickname}\`.`,
                borderless: true,
                color: null,
                allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
            });
        }
    }
}
