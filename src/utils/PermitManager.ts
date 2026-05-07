import { PermissionsBitField, GuildMember, Guild, PermissionFlagsBits } from 'discord.js';
import { ExtendedClient } from '../client';

export enum PermitPermission {
    // ─── Moderation ─────────────────────────────
    BAN = 'BAN',
    KICK = 'KICK',
    MUTE = 'MUTE',
    MODERATE_MEMBERS = 'MODERATE_MEMBERS',
    MANAGE_MESSAGES = 'MANAGE_MESSAGES',
    MANAGE_NICKNAMES = 'MANAGE_NICKNAMES',
    
    // ─── Channel Management ─────────────────────
    MANAGE_CHANNELS = 'MANAGE_CHANNELS',
    MANAGE_THREADS = 'MANAGE_THREADS',
    
    // ─── Role Management ────────────────────────
    MANAGE_ROLES = 'MANAGE_ROLES',
    
    // ─── Server Management ──────────────────────
    ADMINISTRATOR = 'ADMINISTRATOR',
    MANAGE_GUILD = 'MANAGE_GUILD',
    MANAGE_WEBHOOKS = 'MANAGE_WEBHOOKS',
    MANAGE_EMOJIS_AND_STICKERS = 'MANAGE_EMOJIS_AND_STICKERS',
    MANAGE_EVENTS = 'MANAGE_EVENTS',
    VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
    VIEW_GUILD_INSIGHTS = 'VIEW_GUILD_INSIGHTS',
    
    // ─── Voice ──────────────────────────────────
    MOVE_MEMBERS = 'MOVE_MEMBERS',
    MUTE_MEMBERS = 'MUTE_MEMBERS',
    DEAFEN_MEMBERS = 'DEAFEN_MEMBERS',
    PRIORITY_SPEAKER = 'PRIORITY_SPEAKER',
    CONNECT = 'CONNECT',
    SPEAK = 'SPEAK',
    USE_VAD = 'USE_VAD',
    STREAM = 'STREAM',
    
    // ─── Communication ──────────────────────────
    MENTION_EVERYONE = 'MENTION_EVERYONE',
    SEND_TTS_MESSAGES = 'SEND_TTS_MESSAGES',
    ATTACH_FILES = 'ATTACH_FILES',
    EMBED_LINKS = 'EMBED_LINKS',
    ADD_REACTIONS = 'ADD_REACTIONS',
    USE_EXTERNAL_EMOJIS = 'USE_EXTERNAL_EMOJIS',
    USE_EXTERNAL_STICKERS = 'USE_EXTERNAL_STICKERS',
    CREATE_INSTANT_INVITE = 'CREATE_INSTANT_INVITE',
    
    // ─── Bot-Specific ───────────────────────────
    LOCKDOWN = 'LOCKDOWN',
    BYPASS_ANTINUKE = 'BYPASS_ANTINUKE',
    BYPASS_AUTOMOD = 'BYPASS_AUTOMOD',
}

export const PERMIT_CATEGORIES: Record<string, PermitPermission[]> = {
    'Moderation': [
        PermitPermission.BAN,
        PermitPermission.KICK,
        PermitPermission.MUTE,
        PermitPermission.MODERATE_MEMBERS,
        PermitPermission.MANAGE_MESSAGES,
        PermitPermission.MANAGE_NICKNAMES,
    ],
    'Channel Management': [
        PermitPermission.MANAGE_CHANNELS,
        PermitPermission.MANAGE_THREADS,
    ],
    'Role Management': [
        PermitPermission.MANAGE_ROLES,
    ],
    'Server Management': [
        PermitPermission.ADMINISTRATOR,
        PermitPermission.MANAGE_GUILD,
        PermitPermission.MANAGE_WEBHOOKS,
        PermitPermission.MANAGE_EMOJIS_AND_STICKERS,
        PermitPermission.MANAGE_EVENTS,
        PermitPermission.VIEW_AUDIT_LOG,
        PermitPermission.VIEW_GUILD_INSIGHTS,
    ],
    'Voice': [
        PermitPermission.MOVE_MEMBERS,
        PermitPermission.MUTE_MEMBERS,
        PermitPermission.DEAFEN_MEMBERS,
        PermitPermission.PRIORITY_SPEAKER,
        PermitPermission.CONNECT,
        PermitPermission.SPEAK,
        PermitPermission.USE_VAD,
        PermitPermission.STREAM,
    ],
    'Communication': [
        PermitPermission.MENTION_EVERYONE,
        PermitPermission.SEND_TTS_MESSAGES,
        PermitPermission.ATTACH_FILES,
        PermitPermission.EMBED_LINKS,
        PermitPermission.ADD_REACTIONS,
        PermitPermission.USE_EXTERNAL_EMOJIS,
        PermitPermission.USE_EXTERNAL_STICKERS,
        PermitPermission.CREATE_INSTANT_INVITE,
    ],
    'Bot-Specific': [
        PermitPermission.LOCKDOWN,
        PermitPermission.BYPASS_ANTINUKE,
        PermitPermission.BYPASS_AUTOMOD,
    ],
};

// Map PermitPermissions to Discord's PermissionFlagsBits
export const PERMIT_TO_DISCORD_PERM: Partial<Record<PermitPermission, bigint>> = {
    [PermitPermission.BAN]: PermissionFlagsBits.BanMembers,
    [PermitPermission.KICK]: PermissionFlagsBits.KickMembers,
    [PermitPermission.MUTE]: PermissionFlagsBits.ModerateMembers,
    [PermitPermission.MODERATE_MEMBERS]: PermissionFlagsBits.ModerateMembers,
    [PermitPermission.MANAGE_MESSAGES]: PermissionFlagsBits.ManageMessages,
    [PermitPermission.MANAGE_NICKNAMES]: PermissionFlagsBits.ManageNicknames,
    [PermitPermission.MANAGE_CHANNELS]: PermissionFlagsBits.ManageChannels,
    [PermitPermission.MANAGE_THREADS]: PermissionFlagsBits.ManageThreads,
    [PermitPermission.MANAGE_ROLES]: PermissionFlagsBits.ManageRoles,
    [PermitPermission.ADMINISTRATOR]: PermissionFlagsBits.Administrator,
    [PermitPermission.MANAGE_GUILD]: PermissionFlagsBits.ManageGuild,
    [PermitPermission.MANAGE_WEBHOOKS]: PermissionFlagsBits.ManageWebhooks,
    [PermitPermission.MANAGE_EMOJIS_AND_STICKERS]: PermissionFlagsBits.ManageGuildExpressions,
    [PermitPermission.MANAGE_EVENTS]: PermissionFlagsBits.ManageEvents,
    [PermitPermission.VIEW_AUDIT_LOG]: PermissionFlagsBits.ViewAuditLog,
    [PermitPermission.VIEW_GUILD_INSIGHTS]: PermissionFlagsBits.ViewGuildInsights,
    [PermitPermission.MOVE_MEMBERS]: PermissionFlagsBits.MoveMembers,
    [PermitPermission.MUTE_MEMBERS]: PermissionFlagsBits.MuteMembers,
    [PermitPermission.DEAFEN_MEMBERS]: PermissionFlagsBits.DeafenMembers,
    [PermitPermission.PRIORITY_SPEAKER]: PermissionFlagsBits.PrioritySpeaker,
    [PermitPermission.CONNECT]: PermissionFlagsBits.Connect,
    [PermitPermission.SPEAK]: PermissionFlagsBits.Speak,
    [PermitPermission.USE_VAD]: PermissionFlagsBits.UseVAD,
    [PermitPermission.STREAM]: PermissionFlagsBits.Stream,
    [PermitPermission.MENTION_EVERYONE]: PermissionFlagsBits.MentionEveryone,
    [PermitPermission.SEND_TTS_MESSAGES]: PermissionFlagsBits.SendTTSMessages,
    [PermitPermission.ATTACH_FILES]: PermissionFlagsBits.AttachFiles,
    [PermitPermission.EMBED_LINKS]: PermissionFlagsBits.EmbedLinks,
    [PermitPermission.ADD_REACTIONS]: PermissionFlagsBits.AddReactions,
    [PermitPermission.USE_EXTERNAL_EMOJIS]: PermissionFlagsBits.UseExternalEmojis,
    [PermitPermission.USE_EXTERNAL_STICKERS]: PermissionFlagsBits.UseExternalStickers,
    [PermitPermission.CREATE_INSTANT_INVITE]: PermissionFlagsBits.CreateInstantInvite,
};

export class PermitManager {
    /**
     * Check if a user/member is immune (bypass moderation).
     */
    public static async isImmune(
        client: ExtendedClient,
        guildId: string,
        member: GuildMember
    ): Promise<boolean> {
        // Check user-level immunity
        const userPermit = await client.prisma.permit.findUnique({
            where: { guildId_targetId: { guildId, targetId: member.id } }
        });
        if (userPermit?.immunity) return true;

        // Check role-level immunity
        const roleIds = member.roles.cache.map(r => r.id);
        for (const roleId of roleIds) {
            const rolePermit = await client.prisma.permit.findUnique({
                where: { guildId_targetId: { guildId, targetId: roleId } }
            });
            if (rolePermit?.immunity) return true;
        }

        return false;
    }

    /**
     * Check if a user or any of their roles has a specific permit permission.
     */
    public static async hasPermission(
        client: ExtendedClient,
        guildId: string,
        member: GuildMember,
        permission: PermitPermission
    ): Promise<boolean> {
        // Check user-specific permits
        const userPermit = await client.prisma.permit.findUnique({
            where: { guildId_targetId: { guildId, targetId: member.id } }
        });

        if (userPermit) {
            try {
                const perms: string[] = JSON.parse(userPermit.permissions);
                if (perms.includes(permission)) return true;
            } catch {}
        }

        // Check role-based permits — check all member roles
        const roleIds = member.roles.cache.map(r => r.id);
        for (const roleId of roleIds) {
            const rolePermit = await client.prisma.permit.findUnique({
                where: { guildId_targetId: { guildId, targetId: roleId } }
            });
            if (rolePermit) {
                try {
                    const perms: string[] = JSON.parse(rolePermit.permissions);
                    if (perms.includes(permission)) return true;
                } catch {}
            }
        }

        return false;
    }

    /**
     * Get all permits for a user (both user-specific and role-based).
     */
    public static async getUserPermits(
        client: ExtendedClient,
        guildId: string,
        member: GuildMember
    ): Promise<PermitPermission[]> {
        const roleIds = member.roles.cache.map(r => r.id);
        const allTargets = [member.id, ...roleIds];

        const permits = await client.prisma.permit.findMany({
            where: {
                guildId,
                targetId: { in: allTargets }
            }
        });

        // Merge all permissions from all permits
        const allPerms = new Set<PermitPermission>();
        for (const permit of permits) {
            try {
                const perms: string[] = JSON.parse(permit.permissions);
                perms.forEach(p => allPerms.add(p as PermitPermission));
            } catch {}
        }

        return [...allPerms];
    }

    /**
     * Grant a permission to a user or role.
     */
    public static async grant(
        client: ExtendedClient,
        guildId: string,
        permission: PermitPermission,
        options: { targetId: string; type: 'USER' | 'ROLE' }
    ): Promise<void> {
        const existing = await client.prisma.permit.findUnique({
            where: { guildId_targetId: { guildId, targetId: options.targetId } }
        });

        if (existing) {
            const perms: string[] = JSON.parse(existing.permissions);
            if (!perms.includes(permission)) {
                perms.push(permission);
                await client.prisma.permit.update({
                    where: { guildId_targetId: { guildId, targetId: options.targetId } },
                    data: { permissions: JSON.stringify(perms) }
                });
            }
        } else {
            await client.prisma.permit.create({
                data: {
                    guildId,
                    targetId: options.targetId,
                    type: options.type,
                    permissions: JSON.stringify([permission]),
                }
            });
        }
    }

    /**
     * Revoke a permission from a user or role.
     */
    public static async revoke(
        client: ExtendedClient,
        guildId: string,
        permission: PermitPermission,
        options: { targetId: string }
    ): Promise<boolean> {
        const existing = await client.prisma.permit.findUnique({
            where: { guildId_targetId: { guildId, targetId: options.targetId } }
        });

        if (!existing) return false;

        const perms: string[] = JSON.parse(existing.permissions);
        const idx = perms.indexOf(permission);
        if (idx === -1) return false;

        perms.splice(idx, 1);

        if (perms.length === 0) {
            await client.prisma.permit.delete({
                where: { guildId_targetId: { guildId, targetId: options.targetId } }
            });
        } else {
            await client.prisma.permit.update({
                where: { guildId_targetId: { guildId, targetId: options.targetId } },
                data: { permissions: JSON.stringify(perms) }
            });
        }

        return true;
    }

    /**
     * Get the effective permission "level" for a member (higher = more perms).
     */
    public static async getLevel(
        client: ExtendedClient,
        guildId: string,
        member: GuildMember
    ): Promise<number> {
        const perms = await this.getUserPermits(client, guildId, member);
        
        // Weight dangerous permissions higher
        const weights: Partial<Record<PermitPermission, number>> = {
            [PermitPermission.ADMINISTRATOR]: 100,
            [PermitPermission.MANAGE_GUILD]: 50,
            [PermitPermission.BAN]: 40,
            [PermitPermission.KICK]: 30,
            [PermitPermission.MANAGE_ROLES]: 35,
            [PermitPermission.MANAGE_CHANNELS]: 30,
            [PermitPermission.BYPASS_ANTINUKE]: 90,
            [PermitPermission.BYPASS_AUTOMOD]: 20,
            [PermitPermission.LOCKDOWN]: 45,
            [PermitPermission.MUTE]: 25,
            [PermitPermission.MODERATE_MEMBERS]: 25,
        };

        let level = 0;
        for (const p of perms) {
            level += weights[p] || 5;
        }
        return level;
    }

    /**
     * List all permits in a guild, grouped by user/role.
     */
    public static async listAll(
        client: ExtendedClient,
        guildId: string
    ) {
        return client.prisma.permit.findMany({
            where: { guildId },
            orderBy: { type: 'asc' }
        });
    }
}

