import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';
import { AntiNukeTracker } from '../utils/AntiNukeTracker';
import { setTimeout as delay } from 'node:timers/promises';

export default class GuildBanAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanAdd,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        // 1. Audit Log Extraction
        const receivedAt = Date.now();
        let auditLog;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await delay(500);
            const logs = await ban.guild.fetchAuditLogs({ limit: 10, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
            if (!logs) break;
            auditLog = logs.entries.find(entry =>
                entry.targetId === ban.user.id && entry.createdTimestamp >= receivedAt - 10_000
            );
            if (auditLog) break;
        }
        const executor = auditLog?.executor;
        const executorId = auditLog?.executorId;
        const auditReason = auditLog?.reason ?? ban.reason;
        const attribution = executorId && executorId === this.client.user?.id
            ? auditReason?.match(/^\[Enc moderator:(\d{17,20})\]\s*/)
            : undefined;
        const moderatorId = attribution?.[1];
        const reason = attribution ? auditReason!.slice(attribution[0].length) : auditReason;

        // 2. Log to Manifest
        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Banned',
            status: AuditLogStatus.MOD,
            executorId: moderatorId ?? executorId,
            executorTag: moderatorId ? this.client.users.cache.get(moderatorId)?.tag : executor?.tag,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `Reason: ${reason || 'No Reason Provided'}`,
            borderless: true
        });

        // 3. Send Appeal DM (Only if not banned by this bot to avoid duplicates)
        if (executorId !== this.client.user?.id) {
            const { Appeals } = await import('../utils/Appeals');
            await Appeals.sendAppealDM(this.client, ban.user, ban.guild, 'BAN', reason || 'No reason provided');
        }

        // 4. Heat Tracking (Anti-Nuke Heat)
        if (executor?.id && executor.id !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, ban.guild, executor.id, 'BAN');
        }

        // 5. Anti-Nuke Strict & Owner Notification System
        if (executor?.id && executor.id !== this.client.user?.id) {
            const isImmune = await AntiNukeTracker.isImmune(this.client, ban.guild, executor.id);
            if (!isImmune) {
                const strictSettings = await AntiNukeTracker.getStrictSettings(this.client, ban.guild.id);

                if (strictSettings.enabled) {
                    // In Strict Mode, check if bans vector is active
                    if (strictSettings.bans.enabled) {
                        const action = strictSettings.bans.action || 'ALERT_ONLY';

                        if (action === 'STRIP_ROLES') {
                            await ban.guild.bans.remove(ban.user.id, 'Enc Anti-Nuke Strict: Reverting Unauthorized Ban').catch(() => {});
                            await AntiNukeTracker.applyPunishment(this.client, ban.guild, executor.id, 'STRIP_ROLES', 'Unauthorized Member Ban (Strict)');
                        } else if (action === 'BAN') {
                            await ban.guild.bans.remove(ban.user.id, 'Enc Anti-Nuke Strict: Reverting Unauthorized Ban').catch(() => {});
                            await AntiNukeTracker.applyPunishment(this.client, ban.guild, executor.id, 'BAN', 'Unauthorized Member Ban (Strict)');
                        } else if (action === 'KICK') {
                            await ban.guild.bans.remove(ban.user.id, 'Enc Anti-Nuke Strict: Reverting Unauthorized Ban').catch(() => {});
                            await AntiNukeTracker.applyPunishment(this.client, ban.guild, executor.id, 'KICK', 'Unauthorized Member Ban (Strict)');
                        } else if (action === 'MUTE') {
                            await ban.guild.bans.remove(ban.user.id, 'Enc Anti-Nuke Strict: Reverting Unauthorized Ban').catch(() => {});
                            await AntiNukeTracker.applyPunishment(this.client, ban.guild, executor.id, 'MUTE', 'Unauthorized Member Ban (Strict)');
                        } else if (action === 'WARN') {
                            await AntiNukeTracker.applyPunishment(this.client, ban.guild, executor.id, 'WARN', 'Unauthorized Member Ban (Strict)');
                        }

                        await AntiNukeTracker.notifyOwners(this.client, ban.guild, {
                            title: action === 'ALERT_ONLY' ? '🛡️ Security Notification: Member Banned' : '🚨 Strict Anti-Nuke: Unauthorized Ban Intercepted',
                            description: `A member ban was executed on **${ban.guild.name}**.`,
                            fields: [
                                { name: '👤 Moderator', value: `<@${executor.id}> (\`${executor.tag || executor.id}\`)`, inline: true },
                                { name: '🎯 Target', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)`, inline: true },
                                { name: '⚖️ Action Taken', value: `\`${action}\``, inline: true },
                                { name: '📝 Reason', value: `\`${ban.reason || 'No reason provided'}\``, inline: false }
                            ],
                            color: action === 'ALERT_ONLY' ? 0x3b82f6 : 0xef4444
                        });
                    }
                    // If strictSettings.bans.enabled is false, it is kept off.
                } else {
                    // Normal mode: Standard notification alert to owners
                    await AntiNukeTracker.notifyOwners(this.client, ban.guild, {
                        title: '🛡️ Security Notification: Member Banned',
                        description: `A member has been banned from **${ban.guild.name}**.`,
                        fields: [
                            { name: '👤 Moderator', value: `<@${executor.id}> (\`${executor.tag || executor.id}\`)`, inline: true },
                            { name: '🎯 Target', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)`, inline: true },
                            { name: '📝 Reason', value: `\`${ban.reason || 'No reason provided'}\``, inline: false }
                        ],
                        color: 0x3b82f6
                    });
                }
            }
        }
    }
}
