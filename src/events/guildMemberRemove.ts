import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';
import { AntiNukeTracker } from '../utils/AntiNukeTracker';

export default class GuildMemberRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberRemove,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        // 1. Audit Log Check for Kick
        const auditLog = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).then(logs => logs.entries.first()).catch(() => null);
        const isKick = auditLog && auditLog.targetId === member.id && (Date.now() - auditLog.createdTimestamp) < 5000;
        const executorId = isKick ? auditLog.executorId : null;

        // 2. Log to Data Core Manifest
        await AuditLogger.log(this.client, member.guild, {
            type: AuditLogType.MEMBERS,
            event: isKick ? 'Member Kicked' : 'Member Left',
            status: isKick ? AuditLogStatus.MOD : AuditLogStatus.INFO,
            executorId: executorId || undefined,
            executorTag: (isKick ? auditLog?.executor?.tag : undefined) ?? undefined,
            targetId: member.id,
            targetName: member.user.tag,
            details: `Roles: ${member.roles.cache.map(r => r.name).join(', ') || 'No Roles'}`,
            color: isKick ? this.client.color.orange : this.client.color.red
        });

        // 3. Send Appeal DM (Only if not kicked by this bot)
        if (isKick && executorId !== this.client.user?.id) {
            const { Appeals } = await import('../utils/Appeals');
            await Appeals.sendAppealDM(this.client, member.user, member.guild, 'KICK', auditLog?.reason || 'No reason provided');
        }

        // 4. Heat Tracking if it's a kick
        if (isKick && executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, member.guild, executorId, 'KICK');
        }

        // 5. Anti-Nuke Strict & Owner Notification System
        if (isKick && executorId && executorId !== this.client.user?.id) {
            const isImmune = await AntiNukeTracker.isImmune(this.client, member.guild, executorId);
            if (!isImmune) {
                const strictSettings = await AntiNukeTracker.getStrictSettings(this.client, member.guild.id);

                if (strictSettings.enabled) {
                    if (strictSettings.kicks.enabled) {
                        const action = strictSettings.kicks.action || 'ALERT_ONLY';

                        if (action === 'STRIP_ROLES') {
                            await AntiNukeTracker.applyPunishment(this.client, member.guild, executorId, 'STRIP_ROLES', 'Unauthorized Member Kick (Strict)');
                        } else if (action === 'BAN') {
                            await AntiNukeTracker.applyPunishment(this.client, member.guild, executorId, 'BAN', 'Unauthorized Member Kick (Strict)');
                        } else if (action === 'KICK') {
                            await AntiNukeTracker.applyPunishment(this.client, member.guild, executorId, 'KICK', 'Unauthorized Member Kick (Strict)');
                        } else if (action === 'MUTE') {
                            await AntiNukeTracker.applyPunishment(this.client, member.guild, executorId, 'MUTE', 'Unauthorized Member Kick (Strict)');
                        } else if (action === 'WARN') {
                            await AntiNukeTracker.applyPunishment(this.client, member.guild, executorId, 'WARN', 'Unauthorized Member Kick (Strict)');
                        }

                        await AntiNukeTracker.notifyOwners(this.client, member.guild, {
                            title: action === 'ALERT_ONLY' ? '🛡️ Security Notification: Member Kicked' : '🚨 Strict Anti-Nuke: Unauthorized Kick Intercepted',
                            description: `A member kick was executed on **${member.guild.name}**.`,
                            fields: [
                                { name: '👤 Moderator', value: `<@${executorId}> (\`${auditLog?.executor?.tag || executorId}\`)`, inline: true },
                                { name: '🎯 Target', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                                { name: '⚖️ Action Taken', value: `\`${action}\``, inline: true },
                                { name: '📝 Reason', value: `\`${auditLog?.reason || 'No reason provided'}\``, inline: false }
                            ],
                            color: action === 'ALERT_ONLY' ? 0x3b82f6 : 0xef4444
                        });
                    }
                    // If strictSettings.kicks.enabled is false, it is kept off.
                } else {
                    // Normal mode: Standard notification alert to owners
                    await AntiNukeTracker.notifyOwners(this.client, member.guild, {
                        title: '🛡️ Security Notification: Member Kicked',
                        description: `A member has been kicked from **${member.guild.name}**.`,
                        fields: [
                            { name: '👤 Moderator', value: `<@${executorId}> (\`${auditLog?.executor?.tag || executorId}\`)`, inline: true },
                            { name: '🎯 Target', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                            { name: '📝 Reason', value: `\`${auditLog?.reason || 'No reason provided'}\``, inline: false }
                        ],
                        color: 0x3b82f6
                    });
                }
            }
        }

        // 6. Goodbye Message / System Channel Broadcast
        try {
            const guildData = await this.client.prisma.guild.findUnique({
                where: { id: member.guild.id }
            });

            if (guildData?.leaveChannelId) {
                const leaveChannel = member.guild.channels.cache.get(guildData.leaveChannelId) as any;
                if (leaveChannel && leaveChannel.isTextBased()) {
                    const rawLeaveMsg = guildData.leaveMessage || 'Goodbye {user}, we will miss you!';
                    const { PlaceholderManager } = await import('../utils/PlaceholderManager');
                    const resolved = await PlaceholderManager.resolve(this.client, rawLeaveMsg, member, member.guild);
                    
                    await leaveChannel.send({
                        content: resolved.content || undefined,
                        embeds: resolved.embeds,
                        components: resolved.components
                    }).catch(() => {});
                }
            }
        } catch (leaveErr) {
            console.error('Leave message error:', leaveErr);
        }
    }
}
