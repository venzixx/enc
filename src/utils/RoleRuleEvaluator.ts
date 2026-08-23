import { GuildMember, Guild } from 'discord.js';
import { ExtendedClient } from '../client';

export interface Condition {
    type: 'HAS' | 'DOES_NOT_HAVE';
    roleId: string;
}

export interface IRoleRule {
    id: number;
    guildId: string;
    mainRoleId: string;
    mode: 'OR' | 'AND';
    conditions: Condition[] | string;
    action: 'ASSIGN_OR_REMOVE' | 'REMOVE_WHEN_MATCH';
}

export class RoleRuleEvaluator {
    public static async evaluateMember(client: ExtendedClient, member: GuildMember): Promise<void> {
        if (!member || !member.guild) return;

        try {
            const rules = await (client.prisma as any).roleRule.findMany({
                where: { guildId: member.guild.id }
            });

            if (!rules || rules.length === 0) return;

            const currentRoleIds = new Set(member.roles.cache.keys());
            const rolesToAdd = new Set<string>();
            const rolesToRemove = new Set<string>();

            for (const rule of rules) {
                let conditions: Condition[] = [];
                if (Array.isArray(rule.conditions)) {
                    conditions = rule.conditions as Condition[];
                } else if (typeof rule.conditions === 'string') {
                    try {
                        conditions = JSON.parse(rule.conditions);
                    } catch {
                        conditions = [];
                    }
                }

                if (conditions.length === 0) continue;

                let isMatch = false;
                if (rule.mode === 'AND') {
                    isMatch = conditions.every(c => {
                        const hasRole = currentRoleIds.has(c.roleId);
                        return c.type === 'DOES_NOT_HAVE' ? !hasRole : hasRole;
                    });
                } else {
                    // Default 'OR'
                    isMatch = conditions.some(c => {
                        const hasRole = currentRoleIds.has(c.roleId);
                        return c.type === 'DOES_NOT_HAVE' ? !hasRole : hasRole;
                    });
                }

                const hasMainRole = currentRoleIds.has(rule.mainRoleId);

                if (rule.action === 'REMOVE_WHEN_MATCH') {
                    if (isMatch && hasMainRole) {
                        rolesToRemove.add(rule.mainRoleId);
                    }
                } else {
                    // Standard ASSIGN_OR_REMOVE
                    if (isMatch && !hasMainRole) {
                        rolesToAdd.add(rule.mainRoleId);
                    } else if (!isMatch && hasMainRole) {
                        rolesToRemove.add(rule.mainRoleId);
                    }
                }
            }

            // Remove conflicts: if a role is in both, addition takes priority
            for (const rId of rolesToAdd) {
                rolesToRemove.delete(rId);
            }

            if (rolesToAdd.size > 0) {
                await member.roles.add(Array.from(rolesToAdd), 'Role Rule Automation: Assigned').catch(err => {
                    console.error(`[RoleRuleEvaluator] Failed to add roles to ${member.user.tag}: ${err.message}`);
                });
            }

            if (rolesToRemove.size > 0) {
                await member.roles.remove(Array.from(rolesToRemove), 'Role Rule Automation: Removed').catch(err => {
                    console.error(`[RoleRuleEvaluator] Failed to remove roles from ${member.user.tag}: ${err.message}`);
                });
            }
        } catch (error) {
            console.error(`[RoleRuleEvaluator] Error evaluating member ${member.id}:`, error);
        }
    }

    public static async syncGuild(client: ExtendedClient, guildId: string): Promise<{ totalScanned: number; updatedCount: number }> {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return { totalScanned: 0, updatedCount: 0 };

        const rules = await (client.prisma as any).roleRule.findMany({
            where: { guildId: guild.id }
        });

        if (!rules || rules.length === 0) return { totalScanned: 0, updatedCount: 0 };

        const members = await guild.members.fetch({ time: 60000 }).catch(() => guild.members.cache);
        let updatedCount = 0;

        for (const [, member] of members) {
            if (member.user.bot) continue;

            const currentRoleIds = new Set(member.roles.cache.keys());
            const rolesToAdd = new Set<string>();
            const rolesToRemove = new Set<string>();

            for (const rule of rules) {
                let conditions: Condition[] = [];
                if (Array.isArray(rule.conditions)) {
                    conditions = rule.conditions as Condition[];
                } else if (typeof rule.conditions === 'string') {
                    try {
                        conditions = JSON.parse(rule.conditions);
                    } catch {
                        conditions = [];
                    }
                }

                if (conditions.length === 0) continue;

                let isMatch = false;
                if (rule.mode === 'AND') {
                    isMatch = conditions.every(c => {
                        const hasRole = currentRoleIds.has(c.roleId);
                        return c.type === 'DOES_NOT_HAVE' ? !hasRole : hasRole;
                    });
                } else {
                    isMatch = conditions.some(c => {
                        const hasRole = currentRoleIds.has(c.roleId);
                        return c.type === 'DOES_NOT_HAVE' ? !hasRole : hasRole;
                    });
                }

                const hasMainRole = currentRoleIds.has(rule.mainRoleId);

                if (rule.action === 'REMOVE_WHEN_MATCH') {
                    if (isMatch && hasMainRole) {
                        rolesToRemove.add(rule.mainRoleId);
                    }
                } else {
                    if (isMatch && !hasMainRole) {
                        rolesToAdd.add(rule.mainRoleId);
                    } else if (!isMatch && hasMainRole) {
                        rolesToRemove.add(rule.mainRoleId);
                    }
                }
            }

            for (const rId of rolesToAdd) {
                rolesToRemove.delete(rId);
            }

            let memberUpdated = false;
            if (rolesToAdd.size > 0) {
                await member.roles.add(Array.from(rolesToAdd), 'Role Rule Sync: Assigned').catch(() => null);
                memberUpdated = true;
            }
            if (rolesToRemove.size > 0) {
                await member.roles.remove(Array.from(rolesToRemove), 'Role Rule Sync: Removed').catch(() => null);
                memberUpdated = true;
            }

            if (memberUpdated) updatedCount++;
        }

        return {
            totalScanned: members.size,
            updatedCount
        };
    }
}
