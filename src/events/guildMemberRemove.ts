import { Events, GuildMember } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';

export default class GuildMemberRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberRemove,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        // Log to Data Core Manifest
        await AuditLogger.log(this.client, member.guild, {
            type: AuditLogType.MEMBERS,
            event: 'Member Left/Kicked',
            status: AuditLogStatus.INFO,
            targetId: member.id,
            targetName: member.user.tag,
            details: `Roles: ${member.roles.cache.map(r => r.name).join(', ') || 'No Roles'}\nJoined At: ${member.joinedAt?.toDateString() || 'Unknown'}`,
            color: this.client.color.red
        });
    }
}
