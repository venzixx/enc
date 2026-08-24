import {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';

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
            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.mod_unlock} Emergency Unlockdown Protocol Interface`)
                .setColor(0x22c55e)
                .setDescription(
                    `The **Unlockdown Protocol** reverses active containment measures and restores normal server operations.\n\n` +
                    `### ${client.emoji.mod_unlock} Available Unlockdown Modules\n` +
                    `• ${client.emoji.folder_module} \`e!unlockdown channel\` — Unlocks all text/voice channels for @everyone.\n` +
                    `> *Access: Trusted Admins, Extra Owners, Server Owner*\n\n` +
                    `• ${client.emoji.shield} \`e!unlockdown roles\` — Restores original permissions to all stripped roles from backup.\n` +
                    `> *Access: **Extra Owners & Server Owner ONLY***\n\n` +
                    `• ${client.emoji.antinuke_siren} \`e!unlockdown server\` — Reverses full server lockdown (Channels + Roles).\n` +
                    `> *Access: Extra Owners (all) / Trusted Admins (Channels only)*\n\n` +
                    `*💡 Tip: Append \`--force\` to bypass the confirmation dialog.*`
                )
                .setFooter({ text: `Enc Emergency Restoration System` })
                .setTimestamp();

            return await ctx.sendMessage({ embeds: [embed] });
        }

        // ─── PERMISSION VALIDATION ─────────────────────────────────
        if (sub === 'roles') {
            if (!isExtraOwner) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: Only **Extra Owners** and the **Server Owner** can execute \`unlockdown roles\`.`,
                    color: client.color.red,
                    isAlert: true
                });
            }
        } else if (['channel', 'server'].includes(sub)) {
            if (!isTrusted) {
                return await ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} **Access Denied**: You must be a **Trusted Admin** or **Extra Owner** to lift lockdown protocols.`,
                    color: client.color.red,
                    isAlert: true
                });
            }
        } else {
            return await ctx.replyV2({
                description: `${client.emoji.cross || '❌'} Unknown unlockdown module \`${sub}\`. Use \`e!unlockdown\` to view available modules.`,
                color: client.color.red,
                isAlert: true
            });
        }

        // ─── INTERACTIVE CONFIRMATION ─────────────────────────────
        if (!force) {
            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`unlockdown_confirm_${ctx.author.id}`)
                    .setLabel(`Confirm Unlockdown: ${sub.toUpperCase()}`)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`unlockdown_cancel_${ctx.author.id}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            const confirmEmbed = new EmbedBuilder()
                .setTitle(`🔓 Confirm Lockdown Deactivation`)
                .setColor(0x22c55e)
                .setDescription(
                    `Are you ready to lift **Lockdown (${sub.toUpperCase()})** on **${ctx.guild.name}**?\n\n` +
                    `• **Initiator:** <@${ctx.author.id}>\n` +
                    `• **Module:** \`${sub}\`\n` +
                    `• **Effect:** Channel and/or role permissions will be restored to normal.\n\n` +
                    `*Click **Confirm** below to proceed or **Cancel** to abort. (Auto-cancels in 30 seconds)*`
                );

            const promptMsg: any = await ctx.sendMessage({ embeds: [confirmEmbed], components: [confirmRow] });

            const messageObj = promptMsg?.fetch ? await promptMsg.fetch().catch(() => null) : promptMsg;
            const filter = (i: any) => i.user.id === ctx.author.id && i.customId.startsWith('unlockdown_');

            let collector: any = null;
            if (messageObj && typeof messageObj.createMessageComponentCollector === 'function') {
                collector = messageObj.createMessageComponentCollector({ filter, time: 30000, max: 1 });
            } else if (ctx.channel) {
                collector = (ctx.channel as any).createMessageComponentCollector({ filter, time: 30000, max: 1 });
            }

            if (collector) {
                collector.on('collect', async (i: any) => {
                    if (i.customId === `unlockdown_confirm_${ctx.author.id}`) {
                        await i.deferUpdate().catch(() => {});
                        await this.executeUnlockdown(client, ctx, sub, isExtraOwner);
                    } else {
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(`❌ Unlockdown Aborted`)
                                    .setDescription(`Restoration was cancelled by <@${ctx.author.id}>.`)
                                    .setColor(client.color.red || 0xef4444)
                            ],
                            components: []
                        }).catch(() => {});
                    }
                });

                collector.on('end', async (collected: any, reason: string) => {
                    if (reason === 'time' && collected.size === 0) {
                        if (promptMsg && typeof promptMsg.edit === 'function') {
                            await promptMsg.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(`⏱️ Unlockdown Confirmation Timed Out`)
                                        .setDescription(`Request expired without confirmation.`)
                                        .setColor(client.color.red || 0xef4444)
                                ],
                                components: []
                            }).catch(() => {});
                        }
                    }
                });
                return;
            }
        }

        // Force execution
        await this.executeUnlockdown(client, ctx, sub, isExtraOwner);
    }

    /**
     * Executes the unlockdown module.
     */
    private async executeUnlockdown(client: ExtendedClient, ctx: Context, sub: string, isExtraOwner: boolean): Promise<void> {
        const guild = ctx.guild;
        if (!guild) return;

        const results: string[] = [];

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

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.mod_unlock} Emergency Lockdown Lifted`)
            .setColor(0x22c55e)
            .setDescription(
                `Normalcy has been restored by <@${ctx.author.id}>.\n\n` +
                results.join('\n\n')
            )
            .setFooter({ text: `Enc Server Security Core` })
            .setTimestamp();

        await ctx.sendMessage({ embeds: [successEmbed], components: [] });
    }
}
