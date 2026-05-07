import { Events, ThreadChannel } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class ThreadDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ThreadDelete,
        });
    }

    public async run(thread: ThreadChannel): Promise<void> {
        if (!thread.guild) return;

        await AuditLogger.log(this.client, thread.guild, {
            type: AuditLogType.THREADS,
            event: 'Thread Deleted',
            status: AuditLogStatus.INFO,
            targetId: thread.id,
            targetName: thread.name,
            details: `Name: ${thread.name}\nParent: <#${thread.parentId}>`,
            color: this.client.color.red
        });
    }
}
