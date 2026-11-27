import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';
import { ModConfirmation } from '../../utils/ModConfirmation';
import { AuditLogger } from '../../utils/AuditLogger';

const DANGEROUS_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.MentionEveryone
];

export default class LockdownCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'lockdown',
            aliases: ['lock'],
            description: {
                content: 'Emergency lockdown protocols: lock channels, purge recent joins, strip dangerous perms, or lock entire server.',
                usage: 'lockdown <channel|kick|ban|roles|server> [--force]',
                examples: [
                    'lockdown',
                    'lockdown channel',
                    'lockdown kick',
                    'lockdown ban',
                    'lockdown roles',
                    'lockdown server',
                    'lockdown server --force'
                ]
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageRoles,
                    PermissionFlagsBits.KickMembers,
                    PermissionFlagsBits.BanMembers,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            options: [
                {
                    name: 'channel',
                    description: 'Lock all text and voice channels in the server',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'force',
                            description: 'Skip interactive confirmation',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        }
                    ]
                },
                {
                    name: 'kick',
                    description: 'Kick all recent joins (joined in last 24h) with a lockdown DM',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'force',
                            description: 'Skip interactive confirmation',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        }
                    ]
                },
                {
                    name: 'ban',
                    description: 'Ban all recent joins (joined in last 24h) with a lockdown DM (Extra Owner only)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'force',
                            description: 'Skip interactive confirmation',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        }
                    ]
                },
                {
                    name: 'roles',
                    description: 'Strip dangerous permissions from all server roles (Extra Owner only)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'force',
                            description: 'Skip interactive confirmation',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        }
                    ]
                },
                {
                    name: 'server',
                    description: 'Execute full server lockdown (channels + kick + roles)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'force',
                            description: 'Skip interactive confirmation',
                            type: ApplicationCommandOptionType.Boolean,
                            required: false
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };
        const isGuildOwner = ctx.guild.ownerId === ctx.author.id;
        const isBotDev = await isDev(client, ctx.author.id);

        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = isGuildOwner || isBotDev || extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        const trustedAdmins = await client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild.id } });
        const isTrusted = isExtraOwner || trustedAdmins.some((tu: any) => tu.userId === ctx.author.id);

        let sub = '';
        let force = false;

        if (ctx.interaction) {
            sub = (ctx.interaction as any)?.options?.getSubcommand?.(false) || '';
            force = (ctx.interaction as any)?.options?.getBoolean?.('force') || false;
        } else {
            sub = (args[0] || '').toLowerCase();
            force = args.some(a => a === '--force' || a === '-f');
        }

        // Aliases
        if (sub === 'channels') sub = 'channel';
        if (sub === 'role') sub = 'roles';

        // 1. If no subcommand provided, show Overview Hub
        if (!sub) {
            return await ctx.replyV2({
                title: `${client.emoji.antinuke_siren} Emergency Lockdown Protocol Interface`,
                description:
                    `The **Lockdown Protocol** provides rapid containment tools during raids, token breaches, or server emergencies.\n\n` +
                    `### ${client.emoji.mod_lock} Available Lockdown Modules\n` +
                    `• ${client.emoji.folder_module} \`,lockdown channel\` — Locks all text/voice channels for @everyone.\n` +
                    `> *Access: Trusted Admins, Extra Owners, Server Owner*\n\n` +
                    `• ${client.emoji.mod_kick} \`,lockdown kick\` — Kicks all accounts that joined in the last 24h with a lockdown DM.\n` +
                    `> *Access: Trusted Admins, Extra Owners, Server Owner*\n\n` +
                    `• ${client.emoji.mod_ban} \`,lockdown ban\` — Bans all accounts that joined in the last 24h with a lockdown DM.\n` +
                    `> *Access: **Extra Owners & Server Owner ONLY***\n\n` +
                    `• ${client.emoji.shield} \`,lockdown roles\` — Strips administrative & dangerous permissions from all roles.\n` +
                    `> *Access: **Extra Owners & Server Owner ONLY***\n\n` +
                    `• ${client.emoji.antinuke_siren} \`,lockdown server\` — Full emergency containment (Channels + Kick + Roles).\n` +
                    `> *Access: Extra Owners (all 3) / Trusted Admins (Channels + Kick)*\n\n` +
                    `*💡 Tip: Append \`--force\` to bypass the confirmation dialog.*`,
                borderless: true,
                color: null,
                footer: 'To restore normalcy, use ,unlockdown <module>',
                allowedMentions
            });
        }

        // ─── PERMISSION VALIDATION ─────────────────────────────────
        if (['ban', 'roles'].includes(sub)) {
            if (!isExtraOwner) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: Only **Extra Owners** and the **Server Owner** can execute \`lockdown ${sub}\`.`,
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions
                });
            }
        } else if (['channel', 'kick', 'server'].includes(sub)) {
            if (!isTrusted) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: You must be a **Trusted Admin** or **Extra Owner** to initiate lockdown protocols.`,
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions
                });
            }
        } else {
            return await ctx.replyV2({
                description: `${client.emoji.cross || '❌'} Unknown lockdown module \`${sub}\`. Use \`,lockdown\` to view available modules.`,
                borderless: true,
                color: null,
                isAlert: true,
                allowedMentions
            });
        }

        // ─── INTERACTIVE CONFIRMATION ─────────────────────────────
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: `Lockdown (${sub.toUpperCase()})`,
            targetName: ctx.guild.name,
            dangerLevel: ['ban', 'roles', 'server'].includes(sub) ? 'danger' : 'warning',
            details: sub === 'channel' ? 'Locks all text and voice channels for @everyone.'
                   : sub === 'kick' ? 'Kicks all accounts that joined in the last 24 hours with a containment DM.'
                   : sub === 'ban' ? 'Bans all accounts that joined in the last 24 hours with a containment DM.'
                   : sub === 'roles' ? 'Strips administrative and dangerous permissions from all server roles.'
                   : 'Full emergency containment: locks channels, kicks recent joins, and strips dangerous role perms.',
            confirmLabel: `Confirm Lockdown: ${sub.toUpperCase()}`,
            confirmEmoji: '🚨',
            force
        });

        if (!confirmed) return;

        // Force / Confirmed execution
        await this.executeLockdown(client, ctx, sub, isExtraOwner);
    }

    /**
     * Executes the requested lockdown module.
     */
    private async executeLockdown(client: ExtendedClient, ctx: Context, sub: string, isExtraOwner: boolean): Promise<void> {
        const guild = ctx.guild;
        if (!guild) return;

        const results: string[] = [];
        const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };

        // 1. CHANNEL LOCKDOWN
        if (sub === 'channel' || sub === 'server') {
            let lockedCount = 0;
            const channels = guild.channels.cache.filter((c: any) => 
                c.isTextBased() || c.isVoiceBased()
            );

            for (const [_, channel] of channels) {
                try {
                    await (channel as any).permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        SendMessagesInThreads: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false,
                        Connect: false
                    }, { reason: `Emergency Lockdown activated by ${ctx.author.tag}` });
                    lockedCount++;
                } catch {}
            }

            await client.prisma.guild.update({
                where: { id: guild.id },
                data: { lockdownEnabled: true, lockdownMode: 'LOCKED' }
            });

            results.push(`🔒 **Channels Locked:** Successfully locked **${lockedCount}** channels.`);
        }

        // 2. KICK RECENT JOINS
        if (sub === 'kick' || sub === 'server') {
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const members = await guild.members.fetch();
            const recentJoins = members.filter((m: any) => 
                !m.user.bot && 
                m.id !== guild.ownerId && 
                m.joinedTimestamp && 
                m.joinedTimestamp > oneDayAgo
            );

            let kickedCount = 0;
            for (const [_, member] of recentJoins) {
                try {
                    await member.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`🚨 Server Emergency Lockdown`)
                                .setDescription(`You have been temporarily removed from **${guild.name}** as part of an active security lockdown.\n\nYou may rejoin once server security is restored.`)
                                .setColor(0xef4444)
                        ]
                    }).catch(() => {});

                    await member.kick(`Lockdown Kick: Recent join containment by ${ctx.author.tag}`);
                    kickedCount++;
                } catch {}
            }

            results.push(`${client.emoji.mod_kick} **Recent Joins Kicked:** Kicked **${kickedCount}** members (joined in last 24h).`);
        }

        // 3. BAN RECENT JOINS (Extra Owner only)
        if (sub === 'ban') {
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const members = await guild.members.fetch();
            const recentJoins = members.filter((m: any) => 
                !m.user.bot && 
                m.id !== guild.ownerId && 
                m.joinedTimestamp && 
                m.joinedTimestamp > oneDayAgo
            );

            let bannedCount = 0;
            for (const [_, member] of recentJoins) {
                try {
                    await member.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${client.emoji.antinuke_siren} Server Emergency Lockdown`)
                                .setDescription(`You have been banned from **${guild.name}** during an emergency raid containment protocol.`)
                                .setColor(0xef4444)
                        ]
                    }).catch(() => {});

                    await member.ban({ reason: AuditLogger.banReason(ctx.author.id, 'Lockdown Ban: Raid containment') });
                    bannedCount++;
                } catch {}
            }

            results.push(`${client.emoji.mod_ban} **Recent Joins Banned:** Banned **${bannedCount}** members (joined in last 24h).`);
        }

        // 4. ROLES LOCKDOWN (Strip dangerous perms)
        if (sub === 'roles' || (sub === 'server' && isExtraOwner)) {
            const roles = guild.roles.cache.filter((r: any) => 
                r.id !== guild.roles.everyone.id && 
                !r.managed && 
                r.editable
            );

            const savedRolePerms: Record<string, string> = {};
            let modifiedRoles = 0;

            for (const [_, role] of roles) {
                const currentBitfield = role.permissions.bitfield;
                const hasDangerous = DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p));

                if (hasDangerous) {
                    savedRolePerms[role.id] = currentBitfield.toString();
                    
                    // Remove dangerous permissions
                    const cleanPermissions = role.permissions.remove(DANGEROUS_PERMISSIONS);
                    try {
                        await role.setPermissions(cleanPermissions, `Emergency Lockdown: stripped dangerous perms by ${ctx.author.tag}`);
                        modifiedRoles++;
                    } catch {}
                }
            }

            // Save role permissions state to database for restoration
            if (Object.keys(savedRolePerms).length > 0) {
                await client.prisma.guild.update({
                    where: { id: guild.id },
                    data: { lockdownRoles: JSON.stringify(savedRolePerms) }
                });
            }

            results.push(`${client.emoji.shield} **Role Permissions Stripped:** Neutered dangerous permissions on **${modifiedRoles}** roles.`);
        } else if (sub === 'server' && !isExtraOwner) {
            results.push(`${client.emoji.cross} *Role permissions strip skipped (Requires Extra Owner status).*`);
        }

        await ctx.replyV2({
            title: `${client.emoji.antinuke_siren} Emergency Lockdown Protocol Executed`,
            description:
                `Lockdown module **${sub.toUpperCase()}** has been deployed successfully by <@${ctx.author.id}>.\n\n` +
                results.join('\n\n'),
            borderless: true,
            color: null,
            footer: 'Use ,unlockdown <module> to reverse when safe.',
            allowedMentions
        });
    }
}
