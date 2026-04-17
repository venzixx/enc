import { Events, NonThreadGuildBasedChannel } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class ChannelUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ChannelUpdate,
        });
    }

    public async run(oldChannel: NonThreadGuildBasedChannel, newChannel: NonThreadGuildBasedChannel): Promise<void> {
        const changes: string[] = [];
        if (oldChannel.name !== newChannel.name) changes.push(`Name: ${oldChannel.name} -> ${newChannel.name}`);
        if (oldChannel.parentId !== newChannel.parentId) changes.push(`Parent: ${oldChannel.parentId} -> ${newChannel.parentId}`);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newChannel.guild, {
            type: AuditLogType.CHANNELS,
            event: 'Channel Updated',
            status: AuditLogStatus.INFO,
            targetId: newChannel.id,
            targetName: newChannel.name,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
