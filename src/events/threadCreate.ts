import { Events, ThreadChannel } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class ThreadCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ThreadCreate,
        });
    }

    public async run(thread: ThreadChannel, newlyCreated: boolean): Promise<void> {
        if (!newlyCreated) return; // Only log newly created threads
        if (!thread.guild) return;

        await AuditLogger.log(this.client, thread.guild, {
            type: AuditLogType.THREADS,
            event: 'Thread Created',
            status: AuditLogStatus.INFO,
            executorId: thread.ownerId,
            targetId: thread.id,
            targetName: thread.name,
            details: `Name: ${thread.name}\nParent: <#${thread.parentId}>\nType: ${thread.type === 11 ? 'Public Thread' : thread.type === 12 ? 'Private Thread' : 'News Thread'}`,
            color: this.client.color.main
        });
    }
}
