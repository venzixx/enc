import { Events, NonThreadGuildBasedChannel, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { AntiNukeTracker } from '../utils/AntiNukeTracker';

export default class ChannelDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ChannelDelete,
        });
    }

    public async run(channel: NonThreadGuildBasedChannel): Promise<void> {
        const auditLog = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).then(logs => logs.entries.first()).catch(() => null);
        const executor = auditLog?.executor;

        // 1. Audit Logger
        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.CHANNELS,
            event: 'Channel Deleted',
            status: AuditLogStatus.CRITICAL,
            executorId: executor?.id,
            executorTag: executor?.tag,
            targetId: channel.id,
            targetName: channel.name,
            details: `Channel "${channel.name}" (${channel.type}) was deleted.`,
            color: this.client.color.red
        });

        // 2. Anti-Nuke Strict & Owner Notification System
        if (executor && executor.id !== this.client.user?.id) {
            const isImmune = await AntiNukeTracker.isImmune(this.client, channel.guild, executor.id);
            if (!isImmune) {
                const strictSettings = await AntiNukeTracker.getStrictSettings(this.client, channel.guild.id);

                if (strictSettings.enabled) {
                    if (strictSettings.channels.enabled) {
                        const action = strictSettings.channels.action || 'ALERT_ONLY';

                        if (action === 'STRIP_ROLES') {
                            await AntiNukeTracker.applyPunishment(this.client, channel.guild, executor.id, 'STRIP_ROLES', 'Unauthorized Channel Deletion (Strict)');
                        } else if (action === 'BAN') {
                            await AntiNukeTracker.applyPunishment(this.client, channel.guild, executor.id, 'BAN', 'Unauthorized Channel Deletion (Strict)');
                        } else if (action === 'KICK') {
                            await AntiNukeTracker.applyPunishment(this.client, channel.guild, executor.id, 'KICK', 'Unauthorized Channel Deletion (Strict)');
                        } else if (action === 'MUTE') {
                            await AntiNukeTracker.applyPunishment(this.client, channel.guild, executor.id, 'MUTE', 'Unauthorized Channel Deletion (Strict)');
                        } else if (action === 'WARN') {
                            await AntiNukeTracker.applyPunishment(this.client, channel.guild, executor.id, 'WARN', 'Unauthorized Channel Deletion (Strict)');
                        }

                        await AntiNukeTracker.notifyOwners(this.client, channel.guild, {
                            title: action === 'ALERT_ONLY' ? '🛡️ Security Notification: Channel Deleted' : '🚨 Strict Anti-Nuke: Unauthorized Channel Deletion',
                            description: `A channel has been deleted from **${channel.guild.name}**.`,
                            fields: [
                                { name: '👤 Moderator/User', value: `<@${executor.id}> (\`${executor.tag || executor.id}\`)`, inline: true },
                                { name: '📺 Channel', value: `\`#${channel.name}\` (\`${channel.id}\`)`, inline: true },
                                { name: '📁 Type', value: `\`${channel.type}\``, inline: true },
                                { name: '⚖️ Action Taken', value: `\`${action}\``, inline: true }
                            ],
                            color: 0xef4444
                        });
                    }
                    // If strictSettings.channels.enabled is false, it is kept off.
                } else {
                    // Normal mode: Standard notification alert to owners
                    await AntiNukeTracker.notifyOwners(this.client, channel.guild, {
                        title: '🛡️ Security Notification: Channel Deleted',
                        description: `A channel has been deleted from **${channel.guild.name}**.`,
                        fields: [
                            { name: '👤 Moderator/User', value: `<@${executor.id}> (\`${executor.tag || executor.id}\`)`, inline: true },
                            { name: '📺 Channel', value: `\`#${channel.name}\` (\`${channel.id}\`)`, inline: true },
                            { name: '📁 Type', value: `\`${channel.type}\``, inline: true }
                        ],
                        color: 0xef4444
                    });
                }

                // Check rapid occurrences rate-limit
                await AntiNukeTracker.checkAction(this.client, channel.guild, executor.id, 'channel', 'Channel Deletion');
            }
        }
    }
}
