import { Events, GuildScheduledEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildScheduledEventDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildScheduledEventDelete,
        });
    }

    public async run(event: GuildScheduledEvent): Promise<void> {
        if (!event.guild) return;

        await AuditLogger.log(this.client, event.guild, {
            type: AuditLogType.EVENTS,
            event: 'Scheduled Event Deleted',
            status: AuditLogStatus.INFO,
            targetId: event.id,
            targetName: event.name,
            details: `Name: ${event.name}\nID: ${event.id}`,
            color: this.client.color.red
        });
    }
}
