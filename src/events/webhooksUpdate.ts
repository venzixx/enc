import { Events, TextChannel, NewsChannel, VoiceChannel, StageChannel, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { AntiNukeTracker } from '../utils/AntiNukeTracker';

export default class WebhooksUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.WebhooksUpdate,
        });
    }

    public async run(channel: TextChannel | NewsChannel | VoiceChannel | StageChannel): Promise<void> {
        let executorId: string | undefined = undefined;
        let executorTag: string | undefined = undefined;

        try {
            const auditLog = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate }).then(logs => logs.entries.first()).catch(() => null);
            if (auditLog && (Date.now() - auditLog.createdTimestamp) < 10000) {
                executorId = auditLog.executor?.id ?? undefined;
                executorTag = auditLog.executor?.tag ?? undefined;
            }
        } catch {}

        await AuditLogger.log(this.client, channel.guild, {
            type: AuditLogType.WEBHOOKS,
            event: 'Webhook Manifest Shift',
            status: AuditLogStatus.MOD,
            executorId,
            executorTag,
            targetId: channel.id,
            targetName: channel.name,
            details: `A webhook was created, deleted, or modified within #${channel.name}.`,
            color: this.client.color.main
        });

        if (executorId && executorId !== this.client.user?.id) {
            await AntiNukeTracker.checkAction(this.client, channel.guild, executorId, 'webhook', 'Webhook Spam');
        }
    }
}
