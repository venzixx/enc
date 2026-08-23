import { Guild, User, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Message } from 'discord.js';
import { ExtendedClient } from '../client';
import { logModerationAction } from './Logger';
import config from '../config';

export interface CreateCaseOptions {
    guild: Guild;
    type: 'WARN' | 'BAN' | 'KICK' | 'MUTE' | 'TIMEOUT' | 'UNBAN' | 'UNMUTE';
    target: User;
    moderator: User;
    reason: string;
    duration?: string;
    removedRoles?: string[];
}

export interface GetCasesFilter {
    type?: string;
    targetId?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
}

export class CaseManager {
    /**
     * Creates a new moderation case with an incremental case number per guild.
     */
    public static async createCase(client: ExtendedClient, options: CreateCaseOptions) {
        const { guild, type, target, moderator, reason, duration, removedRoles } = options;

        // Fetch highest case number for this guild
        const lastCase = await client.prisma.case.findFirst({
            where: { guildId: guild.id },
            orderBy: { caseNumber: 'desc' },
            select: { caseNumber: true }
        });

        const nextCaseNumber = (lastCase?.caseNumber ?? 0) + 1;

        const newCase = await client.prisma.case.create({
            data: {
                guildId: guild.id,
                caseNumber: nextCaseNumber,
                type: type.toUpperCase(),
                targetId: target.id,
                targetTag: target.tag,
                moderatorId: moderator.id,
                moderatorTag: moderator.tag,
                reason: reason || 'No reason provided',
                duration: duration || null,
                removedRoles: removedRoles && removedRoles.length > 0 ? JSON.stringify(removedRoles) : null,
                active: true,
            }
        });

        // Send mod log with Case #
        await logModerationAction(client, guild, `${type} (Case #${nextCaseNumber})`, moderator, target, reason, duration);

        return newCase;
    }

    /**
     * Restores any admin/moderation roles previously stripped during force mute.
     */
    public static async restoreMutedRoles(client: ExtendedClient, guild: Guild, targetId: string): Promise<string[]> {
        const casesWithRoles = await client.prisma.case.findMany({
            where: {
                guildId: guild.id,
                targetId,
                type: 'MUTE',
                removedRoles: { not: null }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (casesWithRoles.length === 0) return [];

        const restoredRoleNames: string[] = [];
        const member = await guild.members.fetch(targetId).catch(() => null);

        for (const c of casesWithRoles) {
            if (!c.removedRoles) continue;
            try {
                const roleIds: string[] = JSON.parse(c.removedRoles);
                if (member && Array.isArray(roleIds) && roleIds.length > 0) {
                    const validRoleIds = roleIds.filter(id => guild.roles.cache.has(id));
                    if (validRoleIds.length > 0) {
                        for (const rId of validRoleIds) {
                            const r = guild.roles.cache.get(rId);
                            if (r) restoredRoleNames.push(r.name);
                        }
                        await member.roles.add(validRoleIds, 'Force Mute Ended: Restoring admin roles').catch(() => null);
                    }
                }
            } catch (err) {
                console.error('[RESTORE_ROLES_ERROR]', err);
            }

            // Clean up so it's not restored again
            await client.prisma.case.update({
                where: { id: c.id },
                data: { removedRoles: null }
            }).catch(() => null);
        }

        return restoredRoleNames;
    }

    /**
     * Fetches a specific case by case number in a guild.
     */
    public static async getCase(client: ExtendedClient, guildId: string, caseNumber: number) {
        return await client.prisma.case.findUnique({
            where: {
                guildId_caseNumber: {
                    guildId,
                    caseNumber
                }
            }
        });
    }

    /**
     * Edits the reason for an existing case.
     */
    public static async editCase(client: ExtendedClient, guildId: string, caseNumber: number, newReason: string) {
        const existing = await this.getCase(client, guildId, caseNumber);
        if (!existing) return null;

        const updated = await client.prisma.case.update({
            where: {
                guildId_caseNumber: {
                    guildId,
                    caseNumber
                }
            },
            data: {
                reason: newReason
            }
        });

        return { previous: existing, updated };
    }

    /**
     * Deletes a case from the database.
     */
    public static async deleteCase(client: ExtendedClient, guildId: string, caseNumber: number) {
        const existing = await this.getCase(client, guildId, caseNumber);
        if (!existing) return null;

        await client.prisma.case.delete({
            where: {
                guildId_caseNumber: {
                    guildId,
                    caseNumber
                }
            }
        });

        return existing;
    }

    /**
     * Clears all active warnings for a specific user in a guild.
     */
    public static async clearUserWarns(client: ExtendedClient, guildId: string, targetId: string) {
        const deleted = await client.prisma.case.deleteMany({
            where: {
                guildId,
                targetId,
                type: 'WARN'
            }
        });

        return deleted.count;
    }

    /**
     * Gets paginated cases matching filters.
     */
    public static async getCases(client: ExtendedClient, guildId: string, filter: GetCasesFilter = {}) {
        const page = Math.max(1, filter.page ?? 1);
        const limit = Math.max(1, Math.min(25, filter.limit ?? 10));
        const skip = (page - 1) * limit;

        const where: any = { guildId };

        if (filter.type && filter.type.toLowerCase() !== 'all') {
            where.type = filter.type.toUpperCase();
        }

        if (filter.targetId) {
            where.targetId = filter.targetId;
        }

        if (filter.activeOnly) {
            where.active = true;
        }

        const [cases, total] = await Promise.all([
            client.prisma.case.findMany({
                where,
                orderBy: { caseNumber: 'desc' },
                skip,
                take: limit
            }),
            client.prisma.case.count({ where })
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return {
            cases,
            total,
            page,
            totalPages,
            limit
        };
    }

    /**
     * Gets total active warnings count for a target user in a guild.
     */
    public static async getUserWarnCount(client: ExtendedClient, guildId: string, targetId: string): Promise<number> {
        return await client.prisma.case.count({
            where: {
                guildId,
                targetId,
                type: 'WARN',
                active: true
            }
        });
    }

    /**
     * Formats action type with an appropriate emoji.
     */
    public static getActionEmoji(type: string): string {
        switch (type.toUpperCase()) {
            case 'WARN': return config.emoji.mod_warn || '⚠️';
            case 'BAN': return config.emoji.mod_ban || '🔨';
            case 'KICK': return config.emoji.mod_kick || '👢';
            case 'MUTE':
            case 'TIMEOUT': return config.emoji.mod_mute || '🔇';
            case 'UNBAN': return config.emoji.mod_unlock || '🔓';
            case 'UNMUTE': return config.emoji.mod_unmute || '🔊';
            default: return config.emoji.shield || '🛡️';
        }
    }
}

