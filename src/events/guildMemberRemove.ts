import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { HeatManager } from '../utils/HeatManager';

export default class GuildMemberRemove extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildMemberRemove,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        // 1. Audit Log Check for Kick
        const auditLog = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).then(logs => logs.entries.first()).catch(() => null);
        const isKick = auditLog && auditLog.targetId === member.id && (Date.now() - auditLog.createdTimestamp) < 5000;
        const executorId = isKick ? auditLog.executorId : null;

        // 2. Log to Data Core Manifest
        await AuditLogger.log(this.client, member.guild, {
            type: AuditLogType.MEMBERS,
            event: isKick ? 'Member Kicked' : 'Member Left',
            status: isKick ? AuditLogStatus.MOD : AuditLogStatus.INFO,
            executorId: executorId || undefined,
            executorTag: (isKick ? auditLog?.executor?.tag : undefined) ?? undefined,
            targetId: member.id,
            targetName: member.user.tag,
            details: `Roles: ${member.roles.cache.map(r => r.name).join(', ') || 'No Roles'}`,
            color: isKick ? this.client.color.orange : this.client.color.red
        });

        // 3. Heat Tracking if it's a kick
        if (isKick && executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, member.guild, executorId, 'KICK');
        }
    }
}
