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

        // 3. Send Appeal DM (Only if not kicked by this bot)
        if (isKick && executorId !== this.client.user?.id) {
            const { Appeals } = await import('../utils/Appeals');
            await Appeals.sendAppealDM(this.client, member.user, member.guild, 'KICK', auditLog?.reason || 'No reason provided');
        }

        // 4. Heat Tracking if it's a kick
        if (isKick && executorId && executorId !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, member.guild, executorId, 'KICK');
        }

        // 5. Dev Anti-Nuke Alert
        if (isKick && executorId && executorId !== this.client.user?.id) {
            const devAntiNuke = await this.client.prisma.devAntiNuke.findUnique({
                where: { guildId: member.guild.id }
            });
            if (devAntiNuke?.enabled) {
                const { isDev } = await import('../utils/devCheck');
                const isExecutorDev = await isDev(this.client, executorId);
                if (!isExecutorDev) {
                    const hardcodedOwners = ['903646482610126848', '994411485977653248'];
                    const dbDevs = await this.client.prisma.devUser.findMany();
                    const devIds = new Set([...hardcodedOwners, ...dbDevs.map((d: any) => d.userId)]);

                    const alertEmbed = this.client.embed()
                        .setTitle('⚠️ Dev Anti-Nuke: Member Kicked')
                        .setDescription([
                            `**Server:** ${member.guild.name} (${member.guild.id})`,
                            `**Target:** ${member.user.tag} (<@${member.id}>)`,
                            `**Executor:** <@${executorId}> (${executorId})`,
                            `**Reason:** ${auditLog?.reason || 'No reason provided'}`
                        ].join('\n'))
                        .setColor(0xFF0000)
                        .setTimestamp();

                    for (const devId of devIds) {
                        try {
                            const devUser = await this.client.users.fetch(devId);
                            if (devUser) {
                                await devUser.send({ embeds: [alertEmbed] });
                            }
                        } catch (err) {
                            // ignore send errors
                        }
                    }
                }
            }
        }
    }
}
