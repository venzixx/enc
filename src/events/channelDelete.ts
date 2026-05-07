import { Events, NonThreadGuildBasedChannel, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

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
    }
}
