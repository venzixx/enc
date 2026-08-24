import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

export default class SecurityCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 's',
            aliases: ['security', 'sec'],
            description: {
                content: 'Manage server security: extra owners, trusted admins, and automod whitelists.',
                usage: 's <whitelist|trusted|extraowner> <add|remove|list> [@user]',
                examples: [
                    's',
                    's whitelist add @user',
                    's whitelist remove @user',
                    's whitelist list',
                    's trusted add @user',
                    's trusted remove @user',
                    's trusted list',
                    's extraowner add @user',
                    's extraowner remove @user',
                    's extraowner list'
                ]
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'whitelist',
                    description: 'Manage AutoMod immunity whitelist (bypasses spam, links, blacklisted words)',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'add',
                            description: 'Add a user to AutoMod whitelist',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to whitelist from AutoMod',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'remove',
                            description: 'Remove a user from AutoMod whitelist',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove from AutoMod whitelist',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'list',
                            description: 'List all AutoMod whitelisted users',
                            type: ApplicationCommandOptionType.Subcommand
                        }
                    ]
                },
                {
                    name: 'trusted',
                    description: 'Manage Trusted Admins (AntiNuke trust & dashboard access without admin perms)',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'add',
                            description: 'Add a trusted admin',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to grant trusted admin status',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'remove',
                            description: 'Remove a trusted admin',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove from trusted admin status',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'list',
                            description: 'List all trusted admins',
                            type: ApplicationCommandOptionType.Subcommand
                        }
                    ]
                },
                {
                    name: 'extraowner',
                    description: 'Manage Extra Owners (Full immunity & full dashboard access with security settings)',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'add',
                            description: 'Add an extra owner (Server Owner only)',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to grant extra owner status',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'remove',
                            description: 'Remove an extra owner (Server Owner only)',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove from extra owner status',
                                    type: ApplicationCommandOptionType.User,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'list',
                            description: 'List all extra owners',
                            type: ApplicationCommandOptionType.Subcommand
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        const isGuildOwner = ctx.guild.ownerId === ctx.author.id;
        const isBotDev = await isDev(client, ctx.author.id);

        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: ctx.guild.id } });
        const isExtraOwner = isGuildOwner || isBotDev || extraOwners.some((eo: any) => eo.userId === ctx.author.id);

        const trustedAdmins = await client.prisma.trustedUser.findMany({ where: { guildId: ctx.guild.id } });
        const isTrusted = isExtraOwner || trustedAdmins.some((tu: any) => tu.userId === ctx.author.id);

        // Resolve group, action, target
        let group = '';
        let action = '';
        let targetUser: any = null;

        if (ctx.interaction) {
            group = (ctx.interaction as any)?.options?.getSubcommandGroup?.(false) || '';
            action = (ctx.interaction as any)?.options?.getSubcommand?.(false) || '';
            targetUser = (ctx.interaction as any)?.options?.getUser?.('user');
        } else {
            group = (args[0] || '').toLowerCase();
            action = (args[1] || '').toLowerCase();
            if (ctx.message?.mentions.users.first()) {
                targetUser = ctx.message.mentions.users.first();
            } else if (args[2]) {
                const id = args[2].replace(/[<@!>]/g, '');
                targetUser = await client.users.fetch(id).catch(() => null);
            }
        }

        // Aliases for subcommands
        if (group === 'eo' || group === 'extraowners') group = 'extraowner';
        if (group === 'trust' || group === 'trustedadmin' || group === 'trustedadmins') group = 'trusted';
        if (group === 'wl' || group === 'whitelists') group = 'whitelist';

        // 1. If no args or status/antinuke requested, show Overview Hub
        if (!group || group === 'status' || group === 'antinuke') {
            const whitelistedUsers = await client.prisma.whitelistedUser.findMany({ where: { guildId: ctx.guild.id } });
            const guildData = await client.prisma.guild.findUnique({
                where: { id: ctx.guild.id },
                include: { antiNukeConfig: true }
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.shield} Security Management Core`)
                .setColor(0x5865F2)
                .setDescription(
                    `Welcome to the **Enc Security Matrix**. Configure tiered administrative privileges, Anti-Nuke defenses, and AutoMod immunity.\n\n` +
                    `### ${client.emoji.crown_owner} Extra Owners (${extraOwners.length})\n` +
                    `> *Full immunity from Anti-Nuke & AutoMod, full access to Enc Dashboard including Security/Anti-Nuke controls.*\n` +
                    `${extraOwners.length ? extraOwners.map((eo: any) => `• <@${eo.userId}> (\`${eo.userId}\`)`).join('\n') : '• *No Extra Owners assigned.*'}\n\n` +
                    `### ${client.emoji.shield} Trusted Admins (${trustedAdmins.length})\n` +
                    `> *Anti-Nuke bypass & general Dashboard access without requiring Discord Administrator permissions. (Restricted from Security settings).*\n` +
                    `${trustedAdmins.length ? trustedAdmins.map((tu: any) => `• <@${tu.userId}> (\`${tu.userId}\`)`).join('\n') : '• *No Trusted Admins assigned.*'}\n\n` +
                    `### ${client.emoji.mod_blacklist} AutoMod Whitelist (${whitelistedUsers.length})\n` +
                    `> *Immunity from chat AutoMod rules (spam, links, caps, bad words). Does not grant Anti-Nuke or Dashboard access.*\n` +
                    `${whitelistedUsers.length ? whitelistedUsers.map((wu: any) => `• <@${wu.userId}> (\`${wu.userId}\`)`).join('\n') : '• *No Whitelisted Users.*'}`
                )
                .addFields(
                    {
                        name: `${client.emoji.ping_bolt} Quick Command Syntax`,
                        value:
                            '`e!s extraowner <add|remove|list> [@user]`\n' +
                            '`e!s trusted <add|remove|list> [@user]`\n' +
                            '`e!s whitelist <add|remove|list> [@user]`\n' +
                            '`e!antinuke` (View complete status radar)'
                    }
                )
                .setFooter({ text: `Enc Security • Anti-Nuke: ${guildData?.antiNukeEnabled ? 'ACTIVE' : 'DISABLED'}` })
                .setTimestamp();

            return await ctx.sendMessage({ embeds: [embed] });
        }

        // ─── EXTRA OWNER SUBCOMMANDS ─────────────────────────────
        if (group === 'extraowner') {
            if (!isGuildOwner && !isBotDev) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} Only the **Server Owner** can manage Extra Owners.`,
                    color: client.color.red,
                    isAlert: true
                });
            }

            if (action === 'add') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to make Extra Owner.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                if (targetUser.id === ctx.guild.ownerId) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} The server owner is already the primary owner.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                if (targetUser.bot) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Bots cannot be assigned as Extra Owners.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.extraOwner.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is already an Extra Owner.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.extraOwner.create({
                    data: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Added **${targetUser.tag}** as an **Extra Owner**.\n> They now have full immunity and complete access to the web dashboard and security settings.`,
                    color: client.color.green
                });
            }

            if (action === 'remove') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to remove from Extra Owners.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.extraOwner.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (!exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is not an Extra Owner.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.extraOwner.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Removed **${targetUser.tag}** from **Extra Owners**.`,
                    color: client.color.green
                });
            }

            if (action === 'list' || !action) {
                const list = extraOwners.length
                    ? extraOwners.map((eo: any, i: number) => `\`${i + 1}.\` <@${eo.userId}> (\`${eo.userId}\`)`).join('\n')
                    : '*No Extra Owners configured.*';

                const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.crown_owner} Extra Owners — ${ctx.guild.name}`)
                    .setColor(0x5865F2)
                    .setDescription(list)
                    .setFooter({ text: `Total: ${extraOwners.length}` });

                return await ctx.sendMessage({ embeds: [embed] });
            }
        }

        // ─── TRUSTED ADMIN SUBCOMMANDS ───────────────────────────
        if (group === 'trusted') {
            if (!isExtraOwner) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} Only **Extra Owners** or the **Server Owner** can manage Trusted Admins.`,
                    color: client.color.red,
                    isAlert: true
                });
            }

            if (action === 'add') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to add as Trusted Admin.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                if (targetUser.bot) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Bots cannot be added as Trusted Admins.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.trustedUser.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is already a Trusted Admin.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.trustedUser.create({
                    data: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Added **${targetUser.tag}** as a **Trusted Admin**.\n> They now have Anti-Nuke immunity and web dashboard access (excluding security settings).`,
                    color: client.color.green
                });
            }

            if (action === 'remove') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to remove from Trusted Admins.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.trustedUser.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (!exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is not a Trusted Admin.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.trustedUser.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Removed **${targetUser.tag}** from **Trusted Admins**.`,
                    color: client.color.green
                });
            }

            if (action === 'list' || !action) {
                const list = trustedAdmins.length
                    ? trustedAdmins.map((tu: any, i: number) => `\`${i + 1}.\` <@${tu.userId}> (\`${tu.userId}\`)`).join('\n')
                    : '*No Trusted Admins configured.*';

                const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.shield} Trusted Admins — ${ctx.guild.name}`)
                    .setColor(0x5865F2)
                    .setDescription(list)
                    .setFooter({ text: `Total: ${trustedAdmins.length}` });

                return await ctx.sendMessage({ embeds: [embed] });
            }
        }

        // ─── WHITELIST (AUTOMOD ONLY) SUBCOMMANDS ────────────────
        if (group === 'whitelist') {
            if (!isTrusted) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} You do not have permission to manage the AutoMod whitelist.`,
                    color: client.color.red,
                    isAlert: true
                });
            }

            if (action === 'add') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to whitelist.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.whitelistedUser.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is already whitelisted from AutoMod.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.whitelistedUser.create({
                    data: { guildId: ctx.guild.id, userId: targetUser.id }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Added **${targetUser.tag}** to the **AutoMod Whitelist**.\n> They are now immune from chat AutoMod filters (spam, links, bad words).`,
                    color: client.color.green
                });
            }

            if (action === 'remove') {
                if (!targetUser) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} Please mention or provide the ID of the user to remove from whitelist.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                const exists = await client.prisma.whitelistedUser.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                if (!exists) {
                    return await ctx.replyV2({
                        description: `${client.emoji.cross || '❌'} **${targetUser.tag}** is not in the AutoMod whitelist.`,
                        color: client.color.red,
                        isAlert: true
                    });
                }

                await client.prisma.whitelistedUser.delete({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: targetUser.id } }
                });

                return await ctx.replyV2({
                    description: `${client.emoji.success || '✅'} Removed **${targetUser.tag}** from the **AutoMod Whitelist**.`,
                    color: client.color.green
                });
            }

            if (action === 'list' || !action) {
                const whitelisted = await client.prisma.whitelistedUser.findMany({ where: { guildId: ctx.guild.id } });
                const list = whitelisted.length
                    ? whitelisted.map((wu: any, i: number) => `\`${i + 1}.\` <@${wu.userId}> (\`${wu.userId}\`)`).join('\n')
                    : '*No users in AutoMod whitelist.*';

                const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.mod_blacklist} AutoMod Whitelist — ${ctx.guild.name}`)
                    .setColor(0x5865F2)
                    .setDescription(list)
                    .setFooter({ text: `Total: ${whitelisted.length}` });

                return await ctx.sendMessage({ embeds: [embed] });
            }
        }

        return await ctx.replyV2({
            description: `${client.emoji.cross || '❌'} Invalid security module. Use \`e!s whitelist\`, \`e!s trusted\`, or \`e!s extraowner\`.`,
            color: client.color.red,
            isAlert: true
        });
    }
}
