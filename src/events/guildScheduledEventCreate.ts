import { Events, GuildScheduledEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildScheduledEventCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildScheduledEventCreate,
        });
    }

    public async run(event: GuildScheduledEvent): Promise<void> {
        if (!event.guild) return;

        await AuditLogger.log(this.client, event.guild, {
            type: AuditLogType.EVENTS,
            event: 'Scheduled Event Created',
            status: AuditLogStatus.INFO,
            executorId: event.creatorId,
            targetId: event.id,
            targetName: event.name,
            details: `Name: ${event.name}\nDescription: ${event.description || 'None'}\nLocation: ${event.entityMetadata?.location || event.channel?.name || 'Unknown'}\nStart: <t:${Math.floor((event.scheduledStartTimestamp || 0) / 1000)}:F>`,
            color: this.client.color.main
        });
    }
}
