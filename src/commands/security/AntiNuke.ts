import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AntiNukeTracker } from '../../utils/AntiNukeTracker';
import { V2Helper } from '../../utils/V2Helper';
import { isDev } from '../../utils/devCheck';

type AntiNukePage = 'overview' | 'extraowners' | 'trusted';

export default class AntiNukeCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'antinuke',
            aliases: ['an', 'antiraid', 'ans', 'securitystatus'],
            description: {
                content: 'Server Anti-Nuke defense: Strict mode, Extra Owners, Trusted Admins, and rapid deletion shields.',
                usage: 'antinuke <strict|extraowner|trusted|status|enable|disable> [args]',
                examples: [
                    'antinuke',
                    'antinuke status',
                    'antinuke strict enable',
                    'antinuke strict disable',
                    'antinuke extraowner add @user',
                    'antinuke extraowner remove @user',
                    'antinuke extraowner list',
                    'antinuke trusted add @user',
                    'antinuke trusted remove @user',
                    'antinuke trusted list',
                    'antinuke enable',
                    'antinuke disable'
                ]
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageRoles]
            },
            options: [
                {
                    name: 'strict',
                    description: 'Turn strict mode on or off (only Owners can make big changes)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'state',
                            description: 'Enable or disable strict mode',
                            type: ApplicationCommandOptionType.String,
                            required: false,
                            choices: [
                                { name: 'enable', value: 'enable' },
                                { name: 'disable', value: 'disable' },
                                { name: 'status', value: 'status' }
                            ]
                        }
                    ]
                },
                {
                    name: 'extraowner',
                    description: 'Manage Extra Owners (Server Owner only)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'Add, remove, or list extra owners',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'add', value: 'add' },
                                { name: 'remove', value: 'remove' },
                                { name: 'list', value: 'list' }
                            ]
                        },
                        {
                            name: 'user',
                            description: 'The user to add or remove',
                            type: ApplicationCommandOptionType.User,
                            required: false
                        }
                    ]
                },
                {
                    name: 'trusted',
                    description: 'Manage Trusted Users (allowed to invite bots)',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'action',
                            description: 'Add, remove, or list trusted users',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'add', value: 'add' },
                                { name: 'remove', value: 'remove' },
                                { name: 'list', value: 'list' }
                            ]
                        },
                        {
                            name: 'user',
                            description: 'The user to add or remove',
                            type: ApplicationCommandOptionType.User,
                            required: false
                        }
                    ]
                },
                {
                    name: 'status',
                    description: 'View current Anti-Nuke settings and active shields',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'enable',
                    description: 'Turn on Anti-Nuke defense',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'disable',
                    description: 'Turn off Anti-Nuke defense',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
        const isBotDev = await isDev(client, ctx.author.id);
        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = isGuildOwner || isBotDev || extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        let sub = '';
        let action = '';
        let targetUser: any = null;

        if (ctx.interaction) {
            sub = (ctx.interaction as any).options?.getSubcommand(false) || '';
            if (sub === 'strict') {
                action = (ctx.interaction as any).options?.getString('state') || 'status';
            } else if (sub === 'extraowner' || sub === 'trusted') {
                action = (ctx.interaction as any).options?.getString('action') || 'list';
                targetUser = (ctx.interaction as any).options?.getUser('user');
            }
        } else {
            sub = args[0]?.toLowerCase() || 'status';
            action = args[1]?.toLowerCase() || '';

            // Handle user mention or ID in args
            const rawTarget = args[2] || args[1];
            if (rawTarget) {
                const match = rawTarget.match(/<@!?(\d{17,20})>|(\d{17,20})/);
                if (match) {
                    const id = match[1] || match[2];
                    targetUser = await client.users.fetch(id).catch(() => null);
                }
            }
        }

        // ==========================================
        // 1. STRICT MODE SUBCOMMAND
        // ==========================================
        if (sub === 'strict') {
            if (!isExtraOwner) {
                return ctx.replyV2({
                    title: 'Access Denied',
                    description: 'Only the **Server Owner** or **Extra Owners** can configure Strict Anti-Nuke mode.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            const currentStrict = await AntiNukeTracker.isStrictEnabled(client, ctx.guild.id);

            if (!action || action === 'status') {
                const stateText = currentStrict ? `${client.emoji?.success || '✅'} **Enabled**` : `${client.emoji?.cross || '❌'} **Disabled**`;
                return ctx.replyV2({
                    title: `${client.emoji?.mod_lock || '🛡️'} Strict Anti-Nuke Status`,
                    description:
                        `Strict mode is currently ${stateText} for **${ctx.guild.name}**.\n\n` +
                        `• **Who has access:** Only Server Owner & Extra Owners\n` +
                        `• **Bot Invites:** Only Owners & Trusted users can add bots\n` +
                        `• **Rapid Deletion:** Stops anyone deleting 3 channels or roles in 20s\n` +
                        `• **Direct Alerts:** DMs sent to all owners for every ban or kick\n\n` +
                        `*Turn on/off with: \`,antinuke strict <enable|disable>\`*`,
                    color: currentStrict ? client.color.green : client.color.red
                });
            }

            if (!['enable', 'disable', 'on', 'off'].includes(action)) {
                return ctx.replyV2({
                    description: 'Please choose `enable` or `disable`.\n*Example:* `,antinuke strict enable`',
                    isAlert: true,
                    color: client.color.red
                });
            }

            const enable = ['enable', 'on'].includes(action);
            await AntiNukeTracker.setStrictMode(client, ctx.guild.id, enable);

            if (enable) {
                // Ensure master switches are active
                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: {
                        antiNukeEnabled: true,
                        antiNukeBot: true,
                        antiNukeBan: true,
                        antiNukeKick: true,
                        antiNukeChannel: true,
                        antiNukeRole: true
                    }
                }).catch(() => {});
            }

            return ctx.replyV2({
                title: enable ? `${client.emoji?.mod_lock || '🛡️'} Strict Anti-Nuke Enabled` : `${client.emoji?.mod_unlock || '🛡️'} Strict Anti-Nuke Disabled`,
                description: enable
                    ? `**Strict Anti-Nuke** is now **ON** for **${ctx.guild.name}**!\n\n` +
                      `• Only the **Server Owner** and **Extra Owners** can make major changes.\n` +
                      `• Unauthorized bots will be kicked on sight.\n` +
                      `• Rapid channel or role deletes (3 in 20s) will be stopped instantly.\n` +
                      `• Owners will get DMs for all bans and kicks.`
                    : `**Strict Anti-Nuke** has been turned **OFF** for **${ctx.guild.name}**.`,
                color: enable ? client.color.green : client.color.red
            });
        }

        // ==========================================
        // 2. EXTRA OWNER (ADD / REMOVE)
        // ==========================================
        if ((sub === 'extraowner' || sub === 'eo') && (action === 'add' || action === 'remove')) {
            if (action === 'add') {
                if (!isGuildOwner && !isBotDev) {
                    return ctx.replyV2({
                        title: 'Permission Denied',
                        description: 'Only the **Server Owner** can add Extra Owners.',
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (!targetUser) {
                    return ctx.replyV2({
                        description: 'Please mention a user or provide their ID.\n*Example:* `,antinuke extraowner add @user`',
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (targetUser.bot) {
                    return ctx.replyV2({ description: 'Bots cannot be added as Extra Owners.', isAlert: true, color: client.color.red });
                }

                if (targetUser.id === ctx.guild.ownerId) {
                    return ctx.replyV2({ description: 'The Server Owner already has full ownership.', isAlert: true, color: client.color.red });
                }

                const existing = await client.prisma.extraOwner.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (existing) {
                    return ctx.replyV2({ description: `<@${targetUser.id}> is already an Extra Owner.`, isAlert: true, color: client.color.red });
                }

                await client.prisma.extraOwner.create({
                    data: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                return ctx.replyV2({
                    title: `${client.emoji?.crown_owner || '👑'} Extra Owner Added`,
                    description: `<@${targetUser.id}> (\`${targetUser.tag}\`) is now an **Extra Owner**.\nThey have full anti-nuke immunity, can invite bots, and will receive all security alerts.`,
                    color: client.color.green
                });
            }

            if (action === 'remove') {
                if (!isGuildOwner && !isBotDev) {
                    return ctx.replyV2({
                        title: 'Permission Denied',
                        description: 'Only the **Server Owner** can remove Extra Owners.',
                        isAlert: true,
                        color: client.color.red
                    });
                }

                if (!targetUser) {
                    return ctx.replyV2({ description: 'Please mention a user or provide their ID to remove.', isAlert: true, color: client.color.red });
                }

                const deleted = await client.prisma.extraOwner.deleteMany({
                    where: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                if (deleted.count === 0) {
                    return ctx.replyV2({ description: `<@${targetUser.id}> is not currently an Extra Owner.`, isAlert: true, color: client.color.red });
                }

                return ctx.replyV2({
                    title: `${client.emoji?.crown_owner || '👑'} Extra Owner Removed`,
                    description: `<@${targetUser.id}> has been removed from Extra Owners.`,
                    color: client.color.orange
                });
            }
        }

        // ==========================================
        // 3. TRUSTED USERS (ADD / REMOVE)
        // ==========================================
        if (sub === 'trusted' && (action === 'add' || action === 'remove')) {
            if (!isExtraOwner) {
                return ctx.replyV2({
                    title: 'Permission Denied',
                    description: 'Only the **Server Owner** or **Extra Owners** can manage Trusted Users.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            if (action === 'add') {
                if (!targetUser) {
                    return ctx.replyV2({ description: 'Please mention a user or provide their ID.\n*Example:* `,antinuke trusted add @user`', isAlert: true, color: client.color.red });
                }

                const existing = await client.prisma.trustedUser.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (existing) {
                    return ctx.replyV2({ description: `<@${targetUser.id}> is already a Trusted User.`, isAlert: true, color: client.color.red });
                }

                await client.prisma.trustedUser.create({
                    data: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                return ctx.replyV2({
                    title: `${client.emoji?.user || '⭐'} Trusted User Added`,
                    description: `<@${targetUser.id}> (\`${targetUser.tag}\`) is now a **Trusted User**.\nThey can invite bots to the server without triggering anti-nuke protection.`,
                    color: client.color.green
                });
            }

            if (action === 'remove') {
                if (!targetUser) {
                    return ctx.replyV2({ description: 'Please mention a user or provide their ID to remove.', isAlert: true, color: client.color.red });
                }

                const deleted = await client.prisma.trustedUser.deleteMany({
                    where: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                if (deleted.count === 0) {
                    return ctx.replyV2({ description: `<@${targetUser.id}> is not a Trusted User.`, isAlert: true, color: client.color.red });
                }

                return ctx.replyV2({
                    title: `${client.emoji?.user || '⭐'} Trusted User Removed`,
                    description: `<@${targetUser.id}> has been removed from Trusted Users.`,
                    color: client.color.orange
                });
            }
        }

        // ==========================================
        // 4. ENABLE / DISABLE MASTER TOGGLES
        // ==========================================
        if (sub === 'enable' || sub === 'on') {
            if (!isExtraOwner) {
                return ctx.replyV2({ description: 'Only the **Server Owner** or **Extra Owners** can toggle Anti-Nuke.', isAlert: true, color: client.color.red });
            }

            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: {
                    antiNukeEnabled: true,
                    antiNukeBot: true,
                    antiNukeBan: true,
                    antiNukeKick: true,
                    antiNukeChannel: true,
                    antiNukeRole: true
                }
            });

            return ctx.replyV2({
                title: `${client.emoji?.antinuke_siren || '🛡️'} Anti-Nuke Enabled`,
                description: `Anti-Nuke defense is now **ON** for **${ctx.guild.name}**.\nAll core shields are active.`,
                color: client.color.green
            });
        }

        if (sub === 'disable' || sub === 'off') {
            if (!isExtraOwner) {
                return ctx.replyV2({ description: 'Only the **Server Owner** or **Extra Owners** can toggle Anti-Nuke.', isAlert: true, color: client.color.red });
            }

            await Promise.all([
                client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: { antiNukeEnabled: false }
                }),
                AntiNukeTracker.setStrictMode(client, ctx.guild.id, false)
            ]);

            return ctx.replyV2({
                title: `${client.emoji?.antinuke_siren || '🛡️'} Anti-Nuke Disabled`,
                description: `Anti-Nuke defense has been turned **OFF** for **${ctx.guild.name}**.`,
                color: client.color.red
            });
        }

        // ==========================================
        // 5. BORDERLESS V2 PAGINATED DISPLAY
        // ==========================================
        let initialPage: AntiNukePage = 'overview';
        if (sub === 'extraowner' || sub === 'eo') initialPage = 'extraowners';
        else if (sub === 'trusted') initialPage = 'trusted';

        let currentPage: AntiNukePage = initialPage;

        const renderPage = (
            page: AntiNukePage,
            guildData: any,
            isStrict: boolean,
            currentExtra: any[],
            currentTrusted: any[],
            disabledButtons: boolean = false
        ) => {
            const isMasterOn = !!guildData?.antiNukeEnabled;
            let title = '';
            let description = '';

            if (page === 'overview') {
                title = `${client.emoji?.antinuke_siren || '🛡️'} Anti-Nuke Protection — ${ctx.guild!.name}`;
                description = [
                    `Keep your server safe from unauthorized bots, mass channel or role deletions, and rogue bans or kicks.\n`,
                    `### ${client.emoji?.shield || '🛡️'} Status`,
                    `• **Anti-Nuke Defense:** ${isMasterOn ? `${client.emoji?.success || '✅'} **Enabled**` : `${client.emoji?.cross || '❌'} **Disabled**`}`,
                    `• **Strict Mode:** ${isStrict ? `${client.emoji?.mod_lock || '🔒'} **Active**` : `${client.emoji?.mod_unlock || '🔓'} **Off**`}`,
                    `  -# *Strict mode limits major server changes exclusively to the Server Owner & Extra Owners.*\n`,
                    `### ${client.emoji?.ping_bolt || '⚡'} Active Shields`,
                    `• ${client.emoji?.system_bot || '🤖'} **Bot Shield:** ${isStrict || guildData?.antiNukeBot ? `${client.emoji?.success || '✅'} Active` : `${client.emoji?.cross || '❌'} Disabled`} — Unauthorized bots are instantly removed.`,
                    `• ${client.emoji?.folder_module || '📁'} **Channel Protection:** ${client.emoji?.success || '✅'} Active — Stops fast channel deletions *(max 3 in 20s)*.`,
                    `• ${client.emoji?.mod_lock || '🛡️'} **Role Protection:** ${client.emoji?.success || '✅'} Active — Stops fast role deletions *(max 3 in 20s)*.`,
                    `• ${client.emoji?.mod_ban || '🔨'} **Ban & Kick Alerts:** ${isStrict || guildData?.antiNukeBan ? `${client.emoji?.success || '✅'} Active` : `${client.emoji?.cross || '❌'} Disabled`} — Instant alert messages sent to all owners.\n`,
                    `### ${client.emoji?.crown_owner || '👑'} Security Team`,
                    `• **Server Owner:** <@${ctx.guild!.ownerId}>`,
                    `• **Extra Owners (${currentExtra.length}):** ${currentExtra.length > 0 ? currentExtra.map((eo: any) => `<@${eo.userId}>`).join(', ') : '*None*'}`,
                    `• **Trusted Users (${currentTrusted.length}):** ${currentTrusted.length > 0 ? currentTrusted.map((tu: any) => `<@${tu.userId}>`).join(', ') : '*None*'}`,
                    `  -# *Use the buttons below to switch to the Extra Owners or Trusted Users page.*\n`,
                    `### ${client.emoji?.tool_wrench || '📖'} Commands`,
                    `• \`,antinuke strict <enable|disable>\` — Turn strict mode on or off`,
                    `• \`,antinuke extraowner <add|remove|list>\` — Manage extra owners`,
                    `• \`,antinuke trusted <add|remove|list>\` — Manage trusted bot inviters`,
                    `• \`,antinuke <enable|disable>\` — Main anti-nuke toggle`
                ].join('\n');
            } else if (page === 'extraowners') {
                title = `${client.emoji?.crown_owner || '👑'} Extra Owners — ${ctx.guild!.name}`;
                const extraList = currentExtra.length > 0
                    ? currentExtra.map((eo: any, i: number) => `**${i + 1}.** <@${eo.userId}> (\`${eo.userId}\`)`).join('\n')
                    : '*No Extra Owners added yet.*';

                description = [
                    `Extra Owners possess full administrative trust and complete protection immunity.\n`,
                    `### ${client.emoji?.crown_owner || '👑'} Server Owner`,
                    `• <@${ctx.guild!.ownerId}> (\`${ctx.guild!.ownerId}\`)\n`,
                    `### ${client.emoji?.shield || '🛡️'} Extra Owners (${currentExtra.length})`,
                    `${extraList}\n`,
                    `### ${client.emoji?.system_info || 'ℹ️'} Permissions & Privileges`,
                    `• Full immunity from all Anti-Nuke containment actions.`,
                    `• Authorized to invite bots to the server without triggering Bot Shield.`,
                    `• Receives direct alert messages for bans, kicks, and fast channel/role deletions.`,
                    `• Can configure and toggle Strict Anti-Nuke mode.\n`,
                    `### ${client.emoji?.tool_wrench || '📖'} Management Commands`,
                    `• \`,antinuke extraowner add @user\` — Add an extra owner *(Server Owner only)*`,
                    `• \`,antinuke extraowner remove @user\` — Remove an extra owner *(Server Owner only)*`
                ].join('\n');
            } else if (page === 'trusted') {
                title = `${client.emoji?.user || '⭐'} Trusted Users — ${ctx.guild!.name}`;
                const trustedList = currentTrusted.length > 0
                    ? currentTrusted.map((tu: any, i: number) => `**${i + 1}.** <@${tu.userId}> (\`${tu.userId}\`)`).join('\n')
                    : '*No Trusted Users configured yet.*';

                description = [
                    `Trusted Users are authorized members permitted to invite bots without being blocked.\n`,
                    `### ${client.emoji?.system_bot || '🤖'} Trusted Members (${currentTrusted.length})`,
                    `${trustedList}\n`,
                    `### ${client.emoji?.system_info || 'ℹ️'} Permissions & Privileges`,
                    `• Permitted to invite approved bots to the server.`,
                    `• Immune to the automatic rogue bot kick/ban filter.\n`,
                    `### ${client.emoji?.tool_wrench || '📖'} Management Commands`,
                    `• \`,antinuke trusted add @user\` — Add a trusted user *(Owners only)*`,
                    `• \`,antinuke trusted remove @user\` — Remove a trusted user *(Owners only)*`
                ].join('\n');
            }

            // Create buttons
            const btnOverview = new ButtonBuilder()
                .setCustomId('an_nav_overview')
                .setLabel('Overview')
                .setStyle(page === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabledButtons);
            if (client.emoji?.shield) btnOverview.setEmoji(client.emoji.shield);

            const btnExtra = new ButtonBuilder()
                .setCustomId('an_nav_extraowners')
                .setLabel(`Extra Owners (${currentExtra.length})`)
                .setStyle(page === 'extraowners' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabledButtons);
            if (client.emoji?.crown_owner) btnExtra.setEmoji(client.emoji.crown_owner);

            const btnTrusted = new ButtonBuilder()
                .setCustomId('an_nav_trusted')
                .setLabel(`Trusted Users (${currentTrusted.length})`)
                .setStyle(page === 'trusted' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabledButtons);
            if (client.emoji?.user) btnTrusted.setEmoji(client.emoji.user);

            return V2Helper.createLayout({
                borderless: true,
                color: null,
                title: title,
                description: description,
                thumbnail: ctx.guild!.iconURL({ extension: 'png', size: 256 }) || undefined,
                footer: `${ctx.guild!.name} • Anti-Nuke`,
                timestamp: true,
                buttons: [btnOverview, btnExtra, btnTrusted]
            });
        };

        const [guildData, isStrict, trustedUsers] = await Promise.all([
            client.prisma.guild.findUnique({ where: { id: ctx.guild.id } }),
            AntiNukeTracker.isStrictEnabled(client, ctx.guild.id),
            client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild.id } })
        ]);

        const layout = renderPage(currentPage, guildData, isStrict, extraOwners, trustedUsers);

        const responseMsg = await ctx.sendMessage({
            components: layout.components,
            flags: layout.flags
        });

        // Setup Interactive Page Collector
        let targetMsg = responseMsg;
        if (ctx.interaction && (!targetMsg || typeof (targetMsg as any)?.createMessageComponentCollector !== 'function')) {
            targetMsg = await (ctx.interaction as any).fetchReply().catch(() => null);
        }

        if (!targetMsg || typeof (targetMsg as any)?.createMessageComponentCollector !== 'function') {
            return responseMsg;
        }

        const collector = (targetMsg as any).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000
        });

        collector.on('collect', async (i: any) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({
                    content: 'Only the person who used this command can click these tabs.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            if (i.customId === 'an_nav_overview') currentPage = 'overview';
            else if (i.customId === 'an_nav_extraowners') currentPage = 'extraowners';
            else if (i.customId === 'an_nav_trusted') currentPage = 'trusted';

            const [freshExtra, freshTrusted, freshStrict, freshGuild] = await Promise.all([
                client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild!.id } }),
                client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild!.id } }),
                AntiNukeTracker.isStrictEnabled(client, ctx.guild!.id),
                client.prisma.guild.findUnique({ where: { id: ctx.guild!.id } })
            ]);

            const newLayout = renderPage(currentPage, freshGuild, freshStrict, freshExtra, freshTrusted);

            await i.update({
                components: newLayout.components,
                flags: newLayout.flags
            }).catch(() => {});
        });

        collector.on('end', async () => {
            const [freshExtra, freshTrusted, freshStrict, freshGuild] = await Promise.all([
                client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild!.id } }),
                client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild!.id } }),
                AntiNukeTracker.isStrictEnabled(client, ctx.guild!.id),
                client.prisma.guild.findUnique({ where: { id: ctx.guild!.id } })
            ]);

            const expiredLayout = renderPage(currentPage, freshGuild, freshStrict, freshExtra, freshTrusted, true);
            if (targetMsg && typeof (targetMsg as any).edit === 'function') {
                await (targetMsg as any).edit({
                    components: expiredLayout.components,
                    flags: expiredLayout.flags
                }).catch(() => {});
            }
        });

        return responseMsg;
    }
}
