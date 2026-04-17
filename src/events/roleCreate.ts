import { Events, Role } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class RoleCreate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildRoleCreate,
        });
    }

    public async run(role: Role): Promise<void> {
        await AuditLogger.log(this.client, role.guild, {
            type: AuditLogType.ROLES,
            event: 'Role Created',
            status: AuditLogStatus.INFO,
            targetId: role.id,
            targetName: role.name,
            details: `Color: ${role.hexColor}\nPermissions: ${role.permissions.bitfield}`,
            color: this.client.color.main
        });
    }
}
