import { Events, StageInstance } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class StageInstanceCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.StageInstanceCreate,
        });
    }

    public async run(stage: StageInstance): Promise<void> {
        if (!stage.guild) return;

        await AuditLogger.log(this.client, stage.guild, {
            type: AuditLogType.STAGE,
            event: 'Stage Started',
            status: AuditLogStatus.INFO,
            targetId: stage.channelId?.toString(),
            targetName: stage.topic || 'Untitled Stage',
            details: `Topic: ${stage.topic || 'None'}\nChannel: <#${stage.channelId}>\nPrivacy: ${stage.privacyLevel === 2 ? 'Guild Only' : 'Public'}`,
            color: this.client.color.main
        });
    }
}
