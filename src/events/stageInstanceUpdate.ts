import { Events, StageInstance } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class StageInstanceUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.StageInstanceUpdate,
        });
    }

    public async run(oldStage: StageInstance | null, newStage: StageInstance): Promise<void> {
        if (!newStage.guild) return;

        const changes: string[] = [];
        if (oldStage) {
            if (oldStage.topic !== newStage.topic) changes.push(`Topic: \`${oldStage.topic}\` → \`${newStage.topic}\``);
            if (oldStage.privacyLevel !== newStage.privacyLevel) changes.push(`Privacy changed`);
        } else {
            changes.push(`Stage updated: ${newStage.topic}`);
        }

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newStage.guild, {
            type: AuditLogType.STAGE,
            event: 'Stage Updated',
            status: AuditLogStatus.INFO,
            targetId: newStage.channelId?.toString(),
            targetName: newStage.topic || 'Untitled Stage',
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
