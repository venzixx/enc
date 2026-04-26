import { Events, GuildBan } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';

export default class GuildBanAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanAdd,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        // 1. Audit Log Extraction
        const auditLog = await ban.guild.fetchAuditLogs({ limit: 1, type: 22 }).then(logs => logs.entries.first()).catch(() => null);
        const executorId = auditLog?.executorId;

        // 2. Log to Manifest
        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Banned',
            status: AuditLogStatus.MOD,
            executorId: executorId ?? undefined,
            executorTag: auditLog?.executor?.tag ?? undefined,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `Reason: ${ban.reason || 'No Reason Provided'}`,
            color: this.client.color.red
        });

        // 3. Send Appeal DM (Only if not banned by this bot to avoid duplicates)
        if (executorId !== this.client.user?.id) {
            const { Appeals } = await import('../utils/Appeals');
            await Appeals.sendAppealDM(this.client, ban.user, ban.guild, 'BAN', ban.reason || 'No reason provided');
        }

        // 4. Heat Tracking (Anti-Nuke)
        if (executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, ban.guild, executorId, 'BAN');
        }
    }
}
