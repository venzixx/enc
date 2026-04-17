import { Events, TextChannel, NewsChannel, VoiceChannel, StageChannel } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class WebhooksUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.WebhooksUpdate,
        });
    }

    public async run(channel: TextChannel | NewsChannel | VoiceChannel | StageChannel): Promise<void> {
        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.WEBHOOKS,
            event: 'Webhook Manifest Shift',
            status: AuditLogStatus.MOD,
            targetId: channel.id,
            targetName: channel.name,
            details: `A webhook was created, deleted, or modified within this channel manifest.`,
            color: this.client.color.main
        });
    }
}
