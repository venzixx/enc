import { Events, GuildScheduledEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildScheduledEventUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildScheduledEventUpdate,
        });
    }

    public async run(oldEvent: GuildScheduledEvent | null, newEvent: GuildScheduledEvent): Promise<void> {
        if (!newEvent.guild) return;

        const changes: string[] = [];
        if (oldEvent) {
            if (oldEvent.name !== newEvent.name) changes.push(`Name: \`${oldEvent.name}\` → \`${newEvent.name}\``);
            if (oldEvent.description !== newEvent.description) changes.push(`Description updated`);
            if (oldEvent.status !== newEvent.status) changes.push(`Status: \`${oldEvent.status}\` → \`${newEvent.status}\``);
            if (oldEvent.channelId !== newEvent.channelId) changes.push(`Channel: <#${oldEvent.channelId}> → <#${newEvent.channelId}>`);
        } else {
            changes.push(`Event updated: ${newEvent.name}`);
        }

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newEvent.guild, {
            type: AuditLogType.EVENTS,
            event: 'Scheduled Event Updated',
            status: AuditLogStatus.INFO,
            targetId: newEvent.id,
            targetName: newEvent.name,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
