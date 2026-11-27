import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Guild,
    GuildMember,
    PermissionFlagsBits
} from 'discord.js';
import { ExtendedClient } from '../client';
import { PermitManager, PermitPermission } from './PermitManager';

export const KEY_PERMISSIONS: { name: string; flag: bigint }[] = [
    { name: 'Administrator', flag: PermissionFlagsBits.Administrator },
    { name: 'Manage Server', flag: PermissionFlagsBits.ManageGuild },
    { name: 'Manage Roles', flag: PermissionFlagsBits.ManageRoles },
    { name: 'Manage Channels', flag: PermissionFlagsBits.ManageChannels },
    { name: 'Manage Messages', flag: PermissionFlagsBits.ManageMessages },
    { name: 'Manage Nicknames', flag: PermissionFlagsBits.ManageNicknames },
    { name: 'Manage Webhooks', flag: PermissionFlagsBits.ManageWebhooks },
    { name: 'Manage Expressions', flag: PermissionFlagsBits.ManageGuildExpressions },
    { name: 'Kick Members', flag: PermissionFlagsBits.KickMembers },
    { name: 'Ban Members', flag: PermissionFlagsBits.BanMembers },
    { name: 'Mention Everyone', flag: PermissionFlagsBits.MentionEveryone },
    { name: 'View Audit Log', flag: PermissionFlagsBits.ViewAuditLog },
    { name: 'Send Messages', flag: PermissionFlagsBits.SendMessages },
    { name: 'View Channel', flag: PermissionFlagsBits.ViewChannel },
    { name: 'Read Message History', flag: PermissionFlagsBits.ReadMessageHistory },
];

export class PermsHelper {
    /**
     * Builds the Discord native permissions embed and component row.
     */
    public static buildDiscordPermsPayload(
        channel: any,
        member: GuildMember,
        authorId: string
    ) {
        const channelPerms = (channel && 'permissionsFor' in channel)
            ? (channel as any).permissionsFor(member)
            : member.permissions;
        const effectivePerms = channelPerms || member.permissions;

        const granted: string[] = [];
        const denied: string[] = [];

        for (const perm of KEY_PERMISSIONS) {
            if (effectivePerms.has(perm.flag, false)) {
                granted.push(perm.name);
            } else {
                denied.push(perm.name);
            }
        }

        const grantedText = granted.length > 0 ? granted.join('\n') : 'None';
        const deniedText = denied.length > 0 ? denied.join('\n') : 'None';

        const description = `**Granted**\n\n${grantedText}\n\n**Denied**\n\n${deniedText}`;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `Permissions for ${member.user.username}`,
                iconURL: member.displayAvatarURL({ forceStatic: false })
            })
            .setColor(0x2b2d31)
            .setDescription(description);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`perms_enc:${member.id}:${authorId}`)
                .setLabel('Enc perms')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [row]
        };
    }

    /**
     * Builds the Enc Security permissions embed and component row.
     * Shows whether user has Server Owner, Extra Owner (eo), Trusted Admin (ta),
     * and any Security Whitelists (Anti-Nuke, Webhook Guard, AutoMod, Anti-Spam, etc.).
     */
    public static async buildEncPermsPayload(
        client: ExtendedClient,
        guild: Guild,
        member: GuildMember,
        authorId: string
    ) {
        const isOwner = guild.ownerId === member.id;
        const roleIds = member.roles.cache.map(r => r.id);
        const allTargets = [member.id, ...roleIds];

        // 1. Extra Owner check (eo)
        const isExtraOwner = isOwner || !!(await client.prisma.extraOwner.findUnique({
            where: { guildId_userId: { guildId: guild.id, userId: member.id } }
        }).catch(() => null));

        // 2. Trusted Admin check (ta)
        const isTrustedAdmin = isOwner || isExtraOwner || !!(await client.prisma.trustedUser.findUnique({
            where: { guildId_userId: { guildId: guild.id, userId: member.id } }
        }).catch(() => null));

        // 3. Security Whitelist records (Anti-Nuke, Webhook Guard, Spam, Mentions, Links, AutoMod)
        const secWhitelists = await client.prisma.securityWhitelist.findMany({
            where: {
                guildId: guild.id,
                targetId: { in: allTargets }
            }
        }).catch(() => []);

        const activeSecFeatures = new Set<string>();
        for (const sw of secWhitelists) {
            try {
                const feats: string[] = JSON.parse(sw.features);
                feats.forEach(f => activeSecFeatures.add(f.toLowerCase()));
            } catch {}
        }

        // 4. Legacy Whitelist checks (whitelistedUser / whitelistedRole)
        const isLegacyWhitelistedUser = !!(await client.prisma.whitelistedUser.findUnique({
            where: { guildId_userId: { guildId: guild.id, userId: member.id } }
        }).catch(() => null));

        const legacyWhitelistedRoles = await client.prisma.whitelistedRole.findMany({
            where: {
                guildId: guild.id,
                roleId: { in: roleIds }
            }
        }).catch(() => []);

        const hasAntiNukeWhitelist = isOwner || isExtraOwner || isTrustedAdmin ||
            isLegacyWhitelistedUser || legacyWhitelistedRoles.length > 0 ||
            activeSecFeatures.has('antinuke') || activeSecFeatures.has('bot');

        // 5. AutoMod Whitelist
        const autoModWhitelists = await client.prisma.autoModWhitelist.findMany({
            where: {
                guildId: guild.id,
                targetId: { in: allTargets }
            }
        }).catch(() => []);

        const hasAutoModWhitelist = isOwner || isExtraOwner || isTrustedAdmin ||
            autoModWhitelists.length > 0 || activeSecFeatures.has('automod');

        // 6. Webhook Guard Whitelist
        const hasWebhookWhitelist = isOwner || isExtraOwner || activeSecFeatures.has('webhook');

        // 7. Anti-Spam Whitelist
        const hasSpamWhitelist = isOwner || isExtraOwner || activeSecFeatures.has('spam');

        // 8. Mentions & Pings Whitelist
        const hasMentionsWhitelist = isOwner || isExtraOwner || activeSecFeatures.has('mentions');

        // 9. Links & Invites Whitelist
        const hasLinksWhitelist = isOwner || isExtraOwner || activeSecFeatures.has('links');

        // 10. Lockdown Bypass
        const userPermits = await PermitManager.getUserPermits(client, guild.id, member);
        const hasLockdownBypass = isOwner || isExtraOwner || isTrustedAdmin ||
            userPermits.includes(PermitPermission.LOCKDOWN) ||
            userPermits.includes(PermitPermission.BYPASS_ANTINUKE);

        // Assemble Security & Whitelist Items
        const encPermItems: { name: string; has: boolean }[] = [];

        if (isOwner) {
            encPermItems.push({ name: 'Server Owner', has: true });
        }
        encPermItems.push({ name: 'Extra Owner (EO)', has: isExtraOwner });
        encPermItems.push({ name: 'Trusted Admin (TA)', has: isTrustedAdmin });
        encPermItems.push({ name: 'Anti-Nuke Whitelist', has: hasAntiNukeWhitelist });
        encPermItems.push({ name: 'Webhook Guard Whitelist', has: hasWebhookWhitelist });
        encPermItems.push({ name: 'AutoMod Whitelist', has: hasAutoModWhitelist });
        encPermItems.push({ name: 'Anti-Spam Whitelist', has: hasSpamWhitelist });
        encPermItems.push({ name: 'Mentions Whitelist', has: hasMentionsWhitelist });
        encPermItems.push({ name: 'Links Whitelist', has: hasLinksWhitelist });
        encPermItems.push({ name: 'Lockdown Bypass', has: hasLockdownBypass });

        // If the user has specific bot permits granted, include them
        if (userPermits.includes(PermitPermission.BAN)) {
            encPermItems.push({ name: 'Bot Ban Permit', has: true });
        }
        if (userPermits.includes(PermitPermission.KICK)) {
            encPermItems.push({ name: 'Bot Kick Permit', has: true });
        }
        if (userPermits.includes(PermitPermission.MUTE)) {
            encPermItems.push({ name: 'Bot Mute Permit', has: true });
        }

        const granted: string[] = [];
        const denied: string[] = [];

        for (const item of encPermItems) {
            if (item.has) {
                granted.push(item.name);
            } else {
                denied.push(item.name);
            }
        }

        const grantedText = granted.length > 0 ? granted.join('\n') : 'None';
        const deniedText = denied.length > 0 ? denied.join('\n') : 'None';

        const description = `**Granted**\n\n${grantedText}\n\n**Denied**\n\n${deniedText}`;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `Enc Permissions for ${member.user.username}`,
                iconURL: member.displayAvatarURL({ forceStatic: false })
            })
            .setColor(0x2b2d31)
            .setDescription(description);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`perms_real:${member.id}:${authorId}`)
                .setLabel('Discord Perms')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [row]
        };
    }

    /**
     * Alias for buildEncPermsPayload (for backwards compatibility).
     */
    public static async buildFakePermsPayload(
        client: ExtendedClient,
        guild: Guild,
        member: GuildMember,
        authorId: string
    ) {
        return this.buildEncPermsPayload(client, guild, member, authorId);
    }
}
