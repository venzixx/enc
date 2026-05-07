import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildBanRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanRemove,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        // Fetch audit logs for unban
        const auditLog = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove }).then(logs => logs.entries.first()).catch(() => null);
        const executor = auditLog?.executor;

        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Unbanned',
            status: AuditLogStatus.INFO,
            executorId: executor?.id,
            executorTag: executor?.tag,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `User was restored from the ban list.`,
            color: this.client.color.main
        });
    }
}
