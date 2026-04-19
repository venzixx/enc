import { Guild, GuildMember, Role } from 'discord.js';
import { ExtendedClient } from '../client';

export enum PermitPermission {
    BAN = 'BAN',
    KICK = 'KICK',
    MUTE = 'MUTE',
    LOCKDOWN = 'LOCKDOWN',
    MANAGE_CHANNELS = 'MANAGE_CHANNELS',
    MANAGE_ROLES = 'MANAGE_ROLES',
    MANAGE_WEBHOOKS = 'MANAGE_WEBHOOKS',
    BYPASS_ANTINUKE = 'BYPASS_ANTINUKE',
    BYPASS_AUTOMOD = 'BYPASS_AUTOMOD',
}

export class PermitManager {
    /**
     * Checks if a member has a specific permit permission or full immunity.
     */
    public static async hasPermission(client: ExtendedClient, guild: Guild, userId: string, permission: PermitPermission): Promise<boolean> {
        // Server Owner always has all permissions
        if (userId === guild.ownerId) return true;

        // Fetch permit data for the user and their roles
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        const roleIds = member.roles.cache.map(r => r.id);

        const permits = await client.prisma.permit.findMany({
            where: {
                guildId: guild.id,
                OR: [
                    { targetId: userId, type: 'USER' },
                    { targetId: { in: roleIds }, type: 'ROLE' }
                ]
            }
        });

        if (permits.length === 0) return false;

        // Check for full immunity or specific permission
        for (const permit of permits) {
            if (permit.immunity) return true;
            
            const perms: string[] = JSON.parse(permit.permissions || '[]');
            if (perms.includes(permission) || perms.includes('ADMINISTRATOR')) return true;
        }

        return false;
    }

    /**
     * Checks if a user is immune to Auto-Mod / Anti-Nuke
     */
    public static async isImmune(client: ExtendedClient, guild: Guild, userId: string): Promise<boolean> {
        if (userId === guild.ownerId) return true;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        const permits = await client.prisma.permit.findMany({
            where: {
                guildId: guild.id,
                OR: [
                    { targetId: userId, type: 'USER' },
                    { targetId: { in: member.roles.cache.map(r => r.id) }, type: 'ROLE' }
                ]
            }
        });

        return permits.some(p => p.immunity);
    }

    /**
     * Calculates the "Trust Level" (1-6) based on the number of permissions.
     */
    public static getLevel(permissions: string[]): number {
        const count = permissions.length;
        if (count >= 8) return 6;
        if (count >= 6) return 5;
        if (count >= 4) return 4;
        if (count >= 3) return 3;
        if (count >= 2) return 2;
        if (count >= 1) return 1;
        return 0;
    }
}
