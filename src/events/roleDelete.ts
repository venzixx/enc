import { Events, Role } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class RoleDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildRoleDelete,
        });
    }

    public async run(role: Role): Promise<void> {
        await AuditLogger.log(this.client, role.guild, {
            type: AuditLogType.ROLES,
            event: 'Role Deleted',
            status: AuditLogStatus.MOD,
            targetId: role.id,
            targetName: role.name,
            details: `Color: ${role.hexColor}\nPosition: ${role.position}`,
            color: this.client.color.red
        });
    }
}
