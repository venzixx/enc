import { Events, NonThreadGuildBasedChannel } from 'discord.js';
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
        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.CHANNELS,
            event: 'Channel Deleted',
            status: AuditLogStatus.MOD,
            targetId: channel.id,
            targetName: channel.name,
            details: `Type: ${channel.type}\nParent: ${channel.parentId || 'None'}`,
            color: this.client.color.red
        });
    }
}
