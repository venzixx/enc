import { Events, Role, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { AntiNukeTracker } from '../utils/AntiNukeTracker';

export default class RoleDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildRoleDelete,
        });
    }

    public async run(role: Role): Promise<void> {
        const auditLog = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).then(logs => logs.entries.first()).catch(() => null);
        const executor = auditLog?.executor;

        // 1. Audit Logger
        await AuditLogger.log(this.client, role.guild, {
            type: AuditLogType.ROLES,
            event: 'Role Deleted',
            status: AuditLogStatus.CRITICAL,
            executorId: executor?.id,
            executorTag: executor?.tag,
            targetId: role.id,
            targetName: role.name,
            details: `Role "${role.name}" was deleted from the server.`,
            color: this.client.color.red
        });

        // 2. Anti-Nuke Occurrence Rate-Limit Check
        if (executor && executor.id !== this.client.user?.id) {
            await AntiNukeTracker.checkAction(this.client, role.guild, executor.id, 'role', 'Role Deletion');
        }
    }
}
