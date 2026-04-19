import { Events, Role, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';

export default class RoleDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildRoleDelete,
        });
    }

    public async run(role: Role): Promise<void> {
        // 1. Audit Log Extraction
        const auditLog = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).then(logs => logs.entries.first()).catch(() => null);
        const executorId = auditLog?.executorId;

        await AuditLogger.log(this.client, role.guild, {
            type: AuditLogType.ROLES,
            event: 'Role Deleted',
            status: AuditLogStatus.MOD,
            executorId: executorId ?? undefined,
            executorTag: auditLog?.executor?.tag ?? undefined,
            targetId: role.id,
            targetName: role.name,
            details: `Color: ${role.hexColor}\nPosition: ${role.position}`,
            color: this.client.color.red
        });

        // 2. Heat Infusion
        if (executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, role.guild, executorId, 'ROLE');
        }
    }
}
