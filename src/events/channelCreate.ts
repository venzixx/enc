import { Events, GuildChannel, NonThreadGuildBasedChannel, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class ChannelCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ChannelCreate,
        });
    }

    public async run(channel: NonThreadGuildBasedChannel): Promise<void> {
        const auditLog = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate }).then(logs => logs.entries.first()).catch(() => null);
        const executor = auditLog?.executor;

        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.CHANNELS,
            event: 'Channel Created',
            status: AuditLogStatus.INFO,
            executorId: executor?.id,
            executorTag: executor?.tag,
            targetId: channel.id,
            targetName: channel.name,
            details: `Type: ${channel.type}\nParent: ${channel.parentId || 'None'}`,
            color: this.client.color.main
        });
    }
}
