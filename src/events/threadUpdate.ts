import { Events, ThreadChannel } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class ThreadUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ThreadUpdate,
        });
    }

    public async run(oldThread: ThreadChannel, newThread: ThreadChannel): Promise<void> {
        if (!newThread.guild) return;

        const changes: string[] = [];
        if (oldThread.name !== newThread.name) changes.push(`Name: \`${oldThread.name}\` → \`${newThread.name}\``);
        if (oldThread.archived !== newThread.archived) changes.push(newThread.archived ? 'Thread Archived' : 'Thread Unarchived');
        if (oldThread.locked !== newThread.locked) changes.push(newThread.locked ? 'Thread Locked' : 'Thread Unlocked');
        if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) changes.push(`Slowmode: \`${oldThread.rateLimitPerUser}s\` → \`${newThread.rateLimitPerUser}s\``);
        if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) changes.push(`Auto-Archive: \`${oldThread.autoArchiveDuration}min\` → \`${newThread.autoArchiveDuration}min\``);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newThread.guild, {
            type: AuditLogType.THREADS,
            event: 'Thread Updated',
            status: AuditLogStatus.INFO,
            targetId: newThread.id,
            targetName: newThread.name,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
