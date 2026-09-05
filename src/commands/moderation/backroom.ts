import { 
    ChannelType, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    GuildMember 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ModConfirmation } from '../../utils/ModConfirmation';
import { CaseManager } from '../../utils/CaseManager';
import { logModerationAction } from '../../utils/Logger';

export default class Backroom extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'backroom',
            description: {
                content: 'Banish or rescue a user to/from the backrooms, or set up the backroom quarantine.',
                usage: 'backroom <setup | add @user [reason] | remove @user>',
                examples: ['backroom setup', 'backroom add @user Trolling in general', 'backroom remove @user']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels]
            },
            options: [
                {
                    name: 'setup',
                    description: 'Creates the Backroom role under everything, isolates all channels, and creates quarantine room.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'add',
                    description: 'Archives user roles, strips them, and isolates the member in the backrooms.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { 
                            name: 'user', 
                            description: 'The member to banish to the backrooms', 
                            type: ApplicationCommandOptionType.User, 
                            required: true 
                        },
                        {
                            name: 'reason',
                            description: 'Reason for banishing this member',
                            type: ApplicationCommandOptionType.String,
                            required: false
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Restores original roles to the member and frees them from the backrooms.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { 
                            name: 'user', 
                            description: 'The member to rescue from the backrooms', 
                            type: ApplicationCommandOptionType.User, 
                            required: true 
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.isInteraction 
            ? ctx.options.getSubcommand() 
            : (args[0]?.toLowerCase() || 'help');

        if (sub === 'setup') {
            const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });

            // 1. Find or create the Backroom role
            let role = config?.backroomRoleId ? ctx.guild.roles.cache.get(config.backroomRoleId) : null;
            if (!role) {
                role = ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === 'the backrooms');
            }

            if (!role) {
                role = await ctx.guild.roles.create({
                    name: 'The Backrooms',
                    color: '#1a1a1a',
                    permissions: [],
                    reason: 'Backrooms Quarantine Setup'
                });
            } else {
                // Strip permissions from the role to prevent any accidental bypass
                await role.setPermissions([]).catch(() => {});
            }

            // Put the role under everything (position 1 is right above @everyone)
            await role.setPosition(1).catch(() => {});

            // 2. Find or create the Backroom isolation channel
            let channel: any = config?.backroomChannelId ? ctx.guild.channels.cache.get(config.backroomChannelId) : null;
            if (!channel) {
                channel = ctx.guild.channels.cache.find((c: any) => c.name === 'the-backrooms' && c.type === ChannelType.GuildText);
            }

            if (!channel) {
                channel = await ctx.guild.channels.create({
                    name: 'the-backrooms',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: ctx.guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: role.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel, 
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks
                            ],
                            deny: [PermissionFlagsBits.ReadMessageHistory] // Cannot read history
                        }
                    ],
                    reason: 'Backrooms Quarantine Setup'
                });
            } else {
                // Ensure correct permissions on existing channel
                await channel.permissionOverwrites.edit(ctx.guild.id, {
                    ViewChannel: false
                }).catch(() => {});

                await channel.permissionOverwrites.edit(role.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                    ReadMessageHistory: false // Cannot read history
                }).catch(() => {});
            }

            // 3. Update ALL other channels to deny ViewChannel for the Backroom role
            let updatedChannels = 0;
            for (const [_, ch] of ctx.guild.channels.cache) {
                if (ch.id === channel.id) continue;
                if (!ch.isTextBased() && !ch.isVoiceBased() && ch.type !== ChannelType.GuildCategory) continue;

                try {
                    await (ch as any).permissionOverwrites.edit(role.id, {
                        ViewChannel: false
                    });
                    updatedChannels++;
                } catch (_) {}
            }

            // 4. Save role and channel in database
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: {
                    backroomRoleId: role.id,
                    backroomChannelId: channel.id
                }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Backrooms Setup Complete`,
                description: 
                    `The Backroom quarantine system is now fully configured!\n\n` +
                    `• **Quarantine Role:** <@&${role.id}> *(positioned under all roles)*\n` +
                    `• **Isolation Channel:** <#${channel.id}> *(message history hidden for prisoners)*\n` +
                    `• **Channel Restrictions:** Updated **${updatedChannels}** channels to block access.`,
                borderless: true,
                color: null
            });
        }

        if (sub === 'add') {
            const targetUser = ctx.isInteraction 
                ? ctx.options.getUser('user') 
                : (ctx.message?.mentions.users.first() || (args[1] ? await client.users.fetch(args[1].replace(/[<@!>]/g, '')).catch(() => null) : null));

            if (!targetUser) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Missing User`,
                    description: 'Please specify a valid member to banish to the backrooms.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const target = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
            if (!target) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Member Not Found`,
                    description: 'Could not fetch that member from this server.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            // Security & hierarchy checks
            if (target.id === ctx.author.id) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Invalid Action`,
                    description: 'You cannot banish yourself to the backrooms!',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }
            if (target.id === ctx.guild.ownerId) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Permission Denied`,
                    description: 'You cannot banish the server owner to the backrooms!',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }
            if (ctx.member && target.roles.highest.position >= ctx.member.roles.highest.position && ctx.author.id !== ctx.guild.ownerId) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Hierarchy Error`,
                    description: 'You cannot banish a member with a role equal to or higher than yours.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }
            const me = ctx.guild.members.me || await ctx.guild.members.fetchMe().catch(() => null);
            if (me && target.roles.highest.position >= me.roles.highest.position) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Bot Hierarchy Error`,
                    description: 'I cannot banish this member because their highest role is equal to or higher than my highest role.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            if (!config?.backroomRoleId || !config?.backroomChannelId) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Not Configured`,
                    description: 'The backrooms have not been set up yet. Run `/backroom setup` first.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            if (target.roles.cache.has(config.backroomRoleId)) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Already Quarantined`,
                    description: `${target} is already banished in the backrooms!`,
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const reason = ctx.isInteraction 
                ? (ctx.options.getString('reason') || 'Banished to the Backrooms') 
                : (args.slice(2).join(' ') || 'Banished to the Backrooms');

            const confirmed = await ModConfirmation.ask({
                client,
                ctx,
                actionName: 'Banish to Backrooms',
                targetName: `${target.user.tag} (${target.id})`,
                targetAvatar: target.user.displayAvatarURL(),
                dangerLevel: 'danger',
                reason,
                details: 'This will save all current roles, strip them, and restrict access to the backroom channel only.',
                confirmLabel: 'Confirm Banish',
                confirmEmoji: '🚪'
            });

            if (!confirmed) return;

            // Collect non-managed roles to restore later
            const oldRoles = (target.roles.cache as any)
                .filter((r: any) => r.id !== ctx.guild.id && !r.managed)
                .map((r: any) => r.id);

            // Create an active Case entry
            await CaseManager.createCase(client, {
                guild: ctx.guild,
                type: 'BACKROOM' as any,
                target: target.user,
                moderator: ctx.author,
                reason,
                removedRoles: oldRoles
            });

            // Strip non-managed roles and apply backroom role (preserve managed roles like Nitro boost)
            const managedRoles = (target.roles.cache as any).filter((r: any) => r.managed).map((r: any) => r.id);
            await target.roles.set([...managedRoles, config.backroomRoleId]).catch(() => null);

            return ctx.replyV2({
                title: `${client.emoji.success} Member Banished to Backrooms`,
                description: 
                    `${target} has been banished to <#${config.backroomChannelId}>.\n\n` +
                    `• **Target:** ${target.user.tag} (\`${target.id}\`)\n` +
                    `• **Moderator:** <@${ctx.author.id}>\n` +
                    `• **Saved Roles:** ${oldRoles.length} role(s) archived\n` +
                    `• **Access:** Confined strictly to isolation channel\n` +
                    `• **Reason:** ${reason}`,
                borderless: true,
                color: null
            });
        }

        if (sub === 'remove') {
            const targetUser = ctx.isInteraction 
                ? ctx.options.getUser('user') 
                : (ctx.message?.mentions.users.first() || (args[1] ? await client.users.fetch(args[1].replace(/[<@!>]/g, '')).catch(() => null) : null));

            if (!targetUser) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Missing User`,
                    description: 'Please specify a member to rescue from the backrooms.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const target = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
            if (!target) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Member Not Found`,
                    description: 'Could not fetch that member from this server.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            const config = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
            if (!config?.backroomRoleId) {
                return ctx.replyV2({
                    title: `${client.emoji.cross} Not Configured`,
                    description: 'The backrooms have not been set up in this server.',
                    borderless: true,
                    isAlert: true,
                    color: null
                });
            }

            // Find active backroom case for this member
            const activeCase = await client.prisma.case.findFirst({
                where: {
                    guildId: ctx.guild.id,
                    targetId: target.id,
                    type: 'BACKROOM',
                    active: true
                },
                orderBy: { createdAt: 'desc' }
            });

            const confirmed = await ModConfirmation.ask({
                client,
                ctx,
                actionName: 'Rescue from Backrooms',
                targetName: `${target.user.tag} (${target.id})`,
                targetAvatar: target.user.displayAvatarURL(),
                dangerLevel: 'primary',
                details: 'This will restore their saved roles and remove them from quarantine.',
                confirmLabel: 'Confirm Rescue',
                confirmEmoji: '✨'
            });

            if (!confirmed) return;

            let rolesToRestore: string[] = [];
            if (activeCase?.removedRoles) {
                try {
                    rolesToRestore = JSON.parse(activeCase.removedRoles);
                } catch (_) {}
            }

            // Filter roles that still exist in the server and are not the backroom role
            const validRoles = rolesToRestore.filter(id => id !== config.backroomRoleId && ctx.guild.roles.cache.has(id));
            const currentManaged = (target.roles.cache as any).filter((r: any) => r.managed).map((r: any) => r.id);
            const finalRoles = Array.from(new Set([...validRoles, ...currentManaged]));

            await target.roles.set(finalRoles).catch(() => null);

            // Mark active case as closed
            if (activeCase) {
                await client.prisma.case.update({
                    where: { id: activeCase.id },
                    data: { active: false }
                });
            }

            // Log unbackroom action
            await logModerationAction(client, ctx.guild, 'Rescue from Backrooms', ctx.author, target.user, 'Rescued from Backrooms');

            return ctx.replyV2({
                title: `${client.emoji.success} Member Rescued from Backrooms`,
                description: 
                    `${target} has been freed from the Backrooms!\n\n` +
                    `• **Target:** ${target.user.tag} (\`${target.id}\`)\n` +
                    `• **Moderator:** <@${ctx.author.id}>\n` +
                    `• **Restored Roles:** ${validRoles.length} role(s) restored\n` +
                    `• **Quarantine Status:** Removed from quarantine`,
                borderless: true,
                color: null
            });
        }

        // Default help card
        return ctx.replyV2({
            title: '🚪 Backrooms Quarantine Command',
            description: 
                'Manage server quarantine and isolate disruptive members.\n\n' +
                '• `/backroom setup` - Configures role under all roles and locks all channels\n' +
                '• `/backroom add <user> [reason]` - Strips roles and sends user to backrooms\n' +
                '• `/backroom remove <user>` - Restores user original roles and frees them',
            borderless: true,
            color: null
        });
    }
}

