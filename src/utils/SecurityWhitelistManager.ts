import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    EmbedBuilder,
    Guild,
    MessageFlags,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder
} from 'discord.js';
import { ExtendedClient } from '../client';
import { isDev } from './devCheck';

export interface WhitelistFeatureDef {
    key: string;
    name: string;
    emoji: string;
    desc: string;
}

export const WHITELIST_FEATURES: WhitelistFeatureDef[] = [
    { key: 'antinuke', name: 'Anti-Nuke', emoji: '🛡️', desc: 'Bypass mass-action & bot-shield detection' },
    { key: 'webhook', name: 'Webhook Guard', emoji: '🪝', desc: 'Bypass webhook deletion (safe for bots & channels)' },
    { key: 'spam', name: 'Anti-Spam', emoji: '💬', desc: 'Bypass message spam rate limits' },
    { key: 'mentions', name: 'Mentions & Pings', emoji: '📢', desc: 'Bypass mass-mention restrictions' },
    { key: 'links', name: 'Links & Invites', emoji: '🔗', desc: 'Allow posting links and Discord invites' },
    { key: 'automod', name: 'Full AutoMod', emoji: '🚫', desc: 'Complete immunity from all AutoMod rules' }
];

export class SecurityWhitelistManager {
    /**
     * Checks if a user has authority to manage Security Whitelists
     */
    public static async canManage(client: ExtendedClient, guild: Guild, userId: string): Promise<boolean> {
        if (guild.ownerId === userId) return true;
        if (await isDev(client, userId)) return true;

        const extraOwners = await client.prisma.extraOwner.findMany({ where: { guildId: guild.id } });
        if (extraOwners.some((eo: any) => eo.userId === userId)) return true;

        const trustedAdmins = await client.prisma.trustedUser.findMany({ where: { guildId: guild.id } });
        if (trustedAdmins.some((tu: any) => tu.userId === userId)) return true;

        return false;
    }

    /**
     * Renders the interactive panel for a specific target (User, Bot, Role, Channel)
     */
    public static async renderTargetPanel(
        client: ExtendedClient,
        guild: Guild,
        targetId: string,
        targetType: 'USER' | 'ROLE' | 'CHANNEL'
    ): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<any>[] }> {
        // Fetch or init record
        const record = await client.prisma.securityWhitelist.findUnique({
            where: { guildId_targetId: { guildId: guild.id, targetId } }
        });

        let activeFeatures: string[] = [];
        if (record) {
            try {
                activeFeatures = JSON.parse(record.features);
            } catch {
                activeFeatures = [];
            }
        }

        // Target display formatting
        let targetLabel = `<@${targetId}>`;
        let targetKind = 'User / Bot';
        if (targetType === 'ROLE') {
            targetLabel = `<@&${targetId}>`;
            targetKind = 'Role';
        } else if (targetType === 'CHANNEL') {
            targetLabel = `<#${targetId}>`;
            targetKind = 'Channel';
        }

        const featureLines = WHITELIST_FEATURES.map(f => {
            const enabled = activeFeatures.includes(f.key);
            const statusBadge = enabled ? '`ENABLED` ✅' : '`DISABLED` ❌';
            return `• ${f.emoji} **${f.name}:** ${statusBadge}\n  > *${f.desc}*`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Whitelist Matrix — ${targetKind} Permissions`)
            .setColor(activeFeatures.length > 0 ? 0x22c55e : 0x5865f2)
            .setDescription(
                `Configuring granular security and bypass permissions for ${targetLabel} (\`${targetId}\`).\n` +
                `Click the toggle buttons below to enable or disable specific bypasses in real-time.\n\n` +
                featureLines
            )
            .setFooter({ text: `Enc Security Matrix • Target ID: ${targetId}` })
            .setTimestamp();

        // Row 1: Anti-Nuke, Webhooks, Spam
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:antinuke:${targetType}:${targetId}`)
                .setLabel('Anti-Nuke')
                .setEmoji('🛡️')
                .setStyle(activeFeatures.includes('antinuke') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:webhook:${targetType}:${targetId}`)
                .setLabel('Webhook Guard')
                .setEmoji('🪝')
                .setStyle(activeFeatures.includes('webhook') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:spam:${targetType}:${targetId}`)
                .setLabel('Anti-Spam')
                .setEmoji('💬')
                .setStyle(activeFeatures.includes('spam') ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

        // Row 2: Mentions, Links, Full AutoMod
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:mentions:${targetType}:${targetId}`)
                .setLabel('Mentions & Pings')
                .setEmoji('📢')
                .setStyle(activeFeatures.includes('mentions') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:links:${targetType}:${targetId}`)
                .setLabel('Links & Invites')
                .setEmoji('🔗')
                .setStyle(activeFeatures.includes('links') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sec_wl:toggle:automod:${targetType}:${targetId}`)
                .setLabel('Full AutoMod')
                .setEmoji('🚫')
                .setStyle(activeFeatures.includes('automod') ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

        // Row 3: Action Buttons (All, Clear, Overview)
        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`sec_wl:action:all:${targetType}:${targetId}`)
                .setLabel('Enable All')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sec_wl:action:clear:${targetType}:${targetId}`)
                .setLabel('Clear / Remove')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`sec_wl:nav:overview:${targetType}:${targetId}`)
                .setLabel('Overview Hub')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row1, row2, row3] };
    }

    /**
     * Renders the Overview Hub listing all currently whitelisted entities with picker menus
     */
    public static async renderOverviewPanel(
        client: ExtendedClient,
        guild: Guild
    ): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<any>[] }> {
        const whitelists = await client.prisma.securityWhitelist.findMany({
            where: { guildId: guild.id }
        });

        const usersList: string[] = [];
        const rolesList: string[] = [];
        const channelsList: string[] = [];

        for (const wl of whitelists) {
            let feats: string[] = [];
            try {
                feats = JSON.parse(wl.features);
            } catch {
                feats = [];
            }
            if (feats.length === 0) continue;

            const badgeString = feats.map(f => {
                const def = WHITELIST_FEATURES.find(w => w.key === f);
                return def ? `\`${def.name}\`` : `\`${f}\``;
            }).join(' ');

            if (wl.targetType === 'ROLE') {
                rolesList.push(`• <@&${wl.targetId}> → ${badgeString}`);
            } else if (wl.targetType === 'CHANNEL') {
                channelsList.push(`• <#${wl.targetId}> → ${badgeString}`);
            } else {
                usersList.push(`• <@${wl.targetId}> → ${badgeString}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Security Whitelist Radar — ${guild.name}`)
            .setColor(0x5865f2)
            .setDescription(
                `Granular whitelist configuration for **Users, Bots, Roles, and Channels**.\n` +
                `Whitelisted entities can bypass Anti-Nuke protections, Webhook deletions, or AutoMod filters.\n\n` +
                `### 👤 Users & Bots (${usersList.length})\n` +
                `${usersList.length ? usersList.join('\n') : '• *No users or bots whitelisted.*'}\n\n` +
                `### 🏷️ Roles (${rolesList.length})\n` +
                `${rolesList.length ? rolesList.join('\n') : '• *No roles whitelisted.*'}\n\n` +
                `### 📁 Channels (${channelsList.length})\n` +
                `${channelsList.length ? channelsList.join('\n') : '• *No channels whitelisted.*'}`
            )
            .addFields({
                name: '⚡ Quick Usage',
                value:
                    '`e!s whitelist @user` — Configure bypass for a user or bot\n' +
                    '`e!s whitelist @role` — Configure bypass for a role\n' +
                    '`e!s whitelist #channel` — Configure bypass for a channel\n' +
                    '*Or use the drop-down menus below to pick a target immediately!*'
            })
            .setFooter({ text: `Enc Security Core • Total Whitelisted: ${whitelists.length}` })
            .setTimestamp();

        // Dropdown Pickers
        const userSelect = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('sec_wl:select:user')
                .setPlaceholder('👤 Select a User or Bot to configure...')
                .setMinValues(1)
                .setMaxValues(1)
        );

        const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('sec_wl:select:role')
                .setPlaceholder('🏷️ Select a Role to configure...')
                .setMinValues(1)
                .setMaxValues(1)
        );

        const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('sec_wl:select:channel')
                .setPlaceholder('📁 Select a Channel to configure...')
                .setMinValues(1)
                .setMaxValues(1)
        );

        return { embeds: [embed], components: [userSelect, roleSelect, channelSelect] };
    }

    /**
     * Handles any component interaction (Button or Select Menu) prefixed with `sec_wl:`
     */
    public static async handleInteraction(client: ExtendedClient, interaction: any): Promise<boolean> {
        const customId = interaction.customId;
        if (!customId || !customId.startsWith('sec_wl:')) return false;

        if (!interaction.guild) {
            await interaction.reply({ content: '❌ This action can only be used in a server.', flags: MessageFlags.Ephemeral });
            return true;
        }

        // Check permission
        const authorized = await this.canManage(client, interaction.guild, interaction.user.id);
        if (!authorized) {
            await interaction.reply({
                content: '❌ Only **Server Owner**, **Extra Owners**, or **Trusted Admins** can manage security whitelists.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        const parts = customId.split(':');
        // e.g. sec_wl:select:user
        // e.g. sec_wl:toggle:webhook:USER:12345
        // e.g. sec_wl:action:all:USER:12345
        // e.g. sec_wl:nav:overview:USER:12345

        const actionType = parts[1]; // select | toggle | action | nav

        // 1. SELECT MENUS
        if (actionType === 'select') {
            const selectType = parts[2]; // user | role | channel
            const targetId = interaction.values?.[0];
            if (!targetId) return true;

            let targetKind: 'USER' | 'ROLE' | 'CHANNEL' = 'USER';
            if (selectType === 'role') targetKind = 'ROLE';
            else if (selectType === 'channel') targetKind = 'CHANNEL';

            const panel = await this.renderTargetPanel(client, interaction.guild, targetId, targetKind);
            await interaction.update(panel);
            return true;
        }

        // 2. TOGGLE A FEATURE
        if (actionType === 'toggle') {
            const feature = parts[2];
            const targetType = parts[3] as 'USER' | 'ROLE' | 'CHANNEL';
            const targetId = parts[4];

            const existing = await client.prisma.securityWhitelist.findUnique({
                where: { guildId_targetId: { guildId: interaction.guild.id, targetId } }
            });

            let currentFeatures: string[] = [];
            if (existing) {
                try {
                    currentFeatures = JSON.parse(existing.features);
                } catch {
                    currentFeatures = [];
                }
            }

            if (currentFeatures.includes(feature)) {
                currentFeatures = currentFeatures.filter(f => f !== feature);
            } else {
                currentFeatures.push(feature);
            }

            await client.prisma.securityWhitelist.upsert({
                where: { guildId_targetId: { guildId: interaction.guild.id, targetId } },
                update: { features: JSON.stringify(currentFeatures), targetType },
                create: {
                    guildId: interaction.guild.id,
                    targetId,
                    targetType,
                    features: JSON.stringify(currentFeatures)
                }
            });

            const panel = await this.renderTargetPanel(client, interaction.guild, targetId, targetType);
            await interaction.update(panel);
            return true;
        }

        // 3. ACTION (ALL / CLEAR)
        if (actionType === 'action') {
            const act = parts[2]; // all | clear
            const targetType = parts[3] as 'USER' | 'ROLE' | 'CHANNEL';
            const targetId = parts[4];

            if (act === 'all') {
                const allFeatures = WHITELIST_FEATURES.map(f => f.key);
                await client.prisma.securityWhitelist.upsert({
                    where: { guildId_targetId: { guildId: interaction.guild.id, targetId } },
                    update: { features: JSON.stringify(allFeatures), targetType },
                    create: {
                        guildId: interaction.guild.id,
                        targetId,
                        targetType,
                        features: JSON.stringify(allFeatures)
                    }
                });
            } else if (act === 'clear') {
                await client.prisma.securityWhitelist.deleteMany({
                    where: { guildId: interaction.guild.id, targetId }
                });
            }

            const panel = await this.renderTargetPanel(client, interaction.guild, targetId, targetType);
            await interaction.update(panel);
            return true;
        }

        // 4. NAVIGATION
        if (actionType === 'nav') {
            const navDest = parts[2]; // overview
            if (navDest === 'overview') {
                const overview = await this.renderOverviewPanel(client, interaction.guild);
                await interaction.update(overview);
                return true;
            }
        }

        return false;
    }
}
