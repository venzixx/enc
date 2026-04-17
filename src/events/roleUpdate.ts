import { Events, Role } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class RoleUpdate extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildRoleUpdate,
        });
    }

    public async run(oldRole: Role, newRole: Role): Promise<void> {
        const changes: string[] = [];
        if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} -> ${newRole.name}`);
        if (oldRole.hexColor !== newRole.hexColor) changes.push(`Color: ${oldRole.hexColor} -> ${newRole.hexColor}`);
        if (!oldRole.permissions.equals(newRole.permissions)) changes.push(`Permissions Modified`);

        if (changes.length === 0) return;

        await AuditLogger.log(this.client, newRole.guild, {
            type: AuditLogType.ROLES,
            event: 'Role Updated',
            status: AuditLogStatus.INFO,
            targetId: newRole.id,
            targetName: newRole.name,
            details: changes.join('\n'),
            color: this.client.color.main
        });
    }
}
