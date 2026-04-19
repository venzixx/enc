import { Events, NonThreadGuildBasedChannel, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';

export default class ChannelDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ChannelDelete,
        });
    }

    public async run(channel: NonThreadGuildBasedChannel): Promise<void> {
        // 1. Audit Log Extraction
        const auditLog = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).then(logs => logs.entries.first()).catch(() => null);
        const executorId = auditLog?.executorId;

        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.CHANNELS,
            event: 'Channel Deleted',
            status: AuditLogStatus.MOD,
            executorId: executorId ?? undefined,
            executorTag: auditLog?.executor?.tag ?? undefined,
            targetId: channel.id,
            targetName: channel.name,
            details: `Type: ${channel.type}\nParent: ${channel.parentId || 'None'}`,
            color: this.client.color.red
        });

        // 2. Heat Infusion
        if (executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, channel.guild, executorId, 'CHANNEL');
        }
    }
}
