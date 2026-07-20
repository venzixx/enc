import { Events, GuildBan } from 'discord.js';
import { Event } from '../structures';
import { LavamusicEventType } from '../types/events';
import { ExtendedClient } from '../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../utils/AuditLogger';
import { AuditLogEvent } from 'discord.js';
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
        const auditLog = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).then(logs => logs.entries.first()).catch(() => null);
        const executor = auditLog?.executor;

        // 2. Log to Manifest
        await AuditLogger.log(this.client, ban.guild, {
            type: AuditLogType.MODERATION,
            event: 'Member Banned',
            status: AuditLogStatus.MOD,
            executorId: executor?.id,
            executorTag: executor?.tag,
            targetId: ban.user.id,
            targetName: ban.user.tag,
            details: `Reason: ${ban.reason || 'No Reason Provided'}`,
            color: this.client.color.red
        });

        // 3. Send Appeal DM (Only if not banned by this bot to avoid duplicates)
        if (executor?.id !== this.client.user?.id) {
            const { Appeals } = await import('../utils/Appeals');
            await Appeals.sendAppealDM(this.client, ban.user, ban.guild, 'BAN', ban.reason || 'No reason provided');
        }

        // 4. Heat Tracking (Anti-Nuke)
        if (executor?.id && executor.id !== this.client.user?.id) {
            await HeatManager.addHeat(this.client, ban.guild, executor.id, 'BAN');
        }

        // 5. Dev Anti-Nuke Alert for ban
        if (executor?.id && executor.id !== this.client.user?.id) {
            const devAntiNuke = await this.client.prisma.devAntiNuke.findUnique({
                where: { guildId: ban.guild.id }
            });
            if (devAntiNuke?.enabled) {
                const { isDev } = await import('../utils/devCheck');
                const isExecutorDev = await isDev(this.client, executor.id);
                if (!isExecutorDev) {
                    const hardcodedOwners = ['903646482610126848', '994411485977653248'];
                    const dbDevs = await this.client.prisma.devUser.findMany();
                    const devIds = new Set([...hardcodedOwners, ...dbDevs.map((d: any) => d.userId)]);

                    const alertEmbed = this.client.embed()
                        .setTitle('⚠️ Dev Anti-Nuke: Member Banned')
                        .setDescription([
                            `**Server:** ${ban.guild.name} (${ban.guild.id})`,
                            `**Target:** ${ban.user.tag} (<@${ban.user.id}>)`,
                            `**Executor:** <@${executor.id}> (${executor.id})`,
                            `**Reason:** ${ban.reason || 'No reason provided'}`
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
