import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class UnlockdownCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unlockdown',
            aliases: ['unlock'],
            description: {
                content: 'Lift emergency lockdown protocols: restore channel permissions and recover role privileges.',
                usage: 'unlockdown <channel|roles|server> [--force]',
                examples: [
                    'unlockdown',
                    'unlockdown channel',
                    'unlockdown roles',
                    'unlockdown server',
                    'unlockdown server --force'
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
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            options: [
                {
                    name: 'channel',
                    description: 'Unlock all text and voice channels for @everyone',
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
                    description: 'Restore stripped role permissions from backup (Extra Owner only)',
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
                    description: 'Fully lift lockdown on channels and roles',
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
                title: `${client.emoji.mod_unlock} Emergency Unlockdown Protocol Interface`,
                description:
                    `The **Unlockdown Protocol** reverses active containment measures and restores normal server operations.\n\n` +
                    `### ${client.emoji.mod_unlock} Available Unlockdown Modules\n` +
                    `• ${client.emoji.folder_module} \`,unlockdown channel\` — Unlocks all text/voice channels for @everyone.\n` +
                    `> *Access: Trusted Admins, Extra Owners, Server Owner*\n\n` +
                    `• ${client.emoji.shield} \`,unlockdown roles\` — Restores original permissions to all stripped roles from backup.\n` +
                    `> *Access: **Extra Owners & Server Owner ONLY***\n\n` +
                    `• ${client.emoji.antinuke_siren} \`,unlockdown server\` — Reverses full server lockdown (Channels + Roles).\n` +
                    `> *Access: Extra Owners (all) / Trusted Admins (Channels only)*\n\n` +
                    `*💡 Tip: Append \`--force\` to bypass the confirmation dialog.*`,
                borderless: true,
                color: null,
                footer: 'Enc Emergency Restoration System',
                allowedMentions
            });
        }

        // ─── PERMISSION VALIDATION ─────────────────────────────────
        if (sub === 'roles') {
            if (!isExtraOwner) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: Only **Extra Owners** and the **Server Owner** can execute \`unlockdown roles\`.`,
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions
                });
            }
        } else if (['channel', 'server'].includes(sub)) {
            if (!isTrusted) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: You must be a **Trusted Admin** or **Extra Owner** to lift lockdown protocols.`,
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions
                });
            }
        } else {
            return await ctx.replyV2({
                description: `${client.emoji.cross || '❌'} Unknown unlockdown module \`${sub}\`. Use \`,unlockdown\` to view available modules.`,
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
            actionName: `Unlockdown (${sub.toUpperCase()})`,
            targetName: ctx.guild.name,
            dangerLevel: 'primary',
            details: sub === 'channel' ? 'Restores send message and connect permissions across all channels for @everyone.'
                   : sub === 'roles' ? 'Restores original administrative permissions to all stripped roles from backup.'
                   : 'Fully lifts emergency lockdown across all channels and roles.',
            confirmLabel: `Confirm Unlockdown: ${sub.toUpperCase()}`,
            confirmEmoji: '🔓',
            force
        });

        if (!confirmed) return;

        // Force / Confirmed execution
        await this.executeUnlockdown(client, ctx, sub, isExtraOwner);
    }

    /**
     * Executes the unlockdown module.
     */
    private async executeUnlockdown(client: ExtendedClient, ctx: Context, sub: string, isExtraOwner: boolean): Promise<void> {
        const guild = ctx.guild;
        if (!guild) return;

        const results: string[] = [];
        const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };

        // 1. UNLOCK CHANNELS
        if (sub === 'channel' || sub === 'server') {
            let unlockedCount = 0;
            const channels = guild.channels.cache.filter((c: any) => 
                c.isTextBased() || c.isVoiceBased()
            );

            for (const [_, channel] of channels) {
                try {
                    await (channel as any).permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null,
                        SendMessagesInThreads: null,
                        CreatePublicThreads: null,
                        CreatePrivateThreads: null,
                        Connect: null
                    }, { reason: `Lockdown lifted by ${ctx.author.tag}` });
                    unlockedCount++;
                } catch {}
            }

            await client.prisma.guild.update({
                where: { id: guild.id },
                data: { lockdownEnabled: false, lockdownMode: 'PUBLIC' }
            });

            results.push(`${client.emoji.mod_unlock} **Channels Unlocked:** Successfully restored permissions across **${unlockedCount}** channels.`);
        }

        // 2. RESTORE ROLES
        if (sub === 'roles' || (sub === 'server' && isExtraOwner)) {
            const guildData = await client.prisma.guild.findUnique({
                where: { id: guild.id }
            });

            if (guildData?.lockdownRoles) {
                try {
                    const savedRoles: Record<string, string> = JSON.parse(guildData.lockdownRoles);
                    let restoredRoles = 0;

                    for (const [roleId, bitfieldStr] of Object.entries(savedRoles)) {
                        const role = guild.roles.cache.get(roleId);
                        if (role && role.editable) {
                            try {
                                const restoredBitfield = BigInt(bitfieldStr);
                                await role.setPermissions(restoredBitfield, `Lockdown lifted: permissions restored by ${ctx.author.tag}`);
                                restoredRoles++;
                            } catch {}
                        }
                    }

                    // Clear backup
                    await client.prisma.guild.update({
                        where: { id: guild.id },
                        data: { lockdownRoles: null }
                    });

                    results.push(`${client.emoji.shield} **Role Permissions Restored:** Recovered original administrative permissions for **${restoredRoles}** roles.`);
                } catch (e: any) {
                    results.push(`${client.emoji.cross} *Error parsing role permissions backup: ${e.message}*`);
                }
            } else {
                results.push(`${client.emoji.system_info} *No stored role permission backups found in database.*`);
            }
        } else if (sub === 'server' && !isExtraOwner) {
            results.push(`${client.emoji.cross} *Role restoration skipped (Requires Extra Owner status).*`);
        }

        await ctx.replyV2({
            title: `${client.emoji.mod_unlock} Emergency Lockdown Lifted`,
            description:
                `Normalcy has been restored by <@${ctx.author.id}>.\n\n` +
                results.join('\n\n'),
            borderless: true,
            color: null,
            footer: 'Enc Server Security Core',
            allowedMentions
        });
    }
}
