import { Events, Webhook, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { AuditLogger, AuditLogType, AuditLogStatus } from "../../utils/AuditLogger";

export default class AntiNukeWebhookGuard extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.WebhooksUpdate,
        });
    }

    public async run(channel: any): Promise<void> {
        const guild = channel.guild;
        if (!guild) return;

        // 1. Check if system is enabled
        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: guild.id },
            include: {
                extraOwners: true,
                trustedUsers: true
            }
        });

        if (!guildData?.antiNukeEnabled || !guildData?.antiNukeWebhook) return;

        // 2. Fetch the latest audit log for webhook creation
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.WebhookCreate,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId || log.executorId === this.client.user?.id) return;

        // 3. Bypass Checks
        const isOwner = log.executorId === guild.ownerId;
        const isExtraOwner = guildData.extraOwners.some(eo => eo.userId === log.executorId);
        const isTrusted = guildData.trustedUsers.some(tu => tu.userId === log.executorId);

        if (isOwner || isExtraOwner || isTrusted) return;

        // Granular Whitelist Bypass Check (Bot/User, Channel, Role)
        const targetsToCheck = [log.executorId, channel.id];
        if (channel.parentId) targetsToCheck.push(channel.parentId);

        const whitelists = await this.client.prisma.securityWhitelist.findMany({
            where: {
                guildId: guild.id,
                targetId: { in: targetsToCheck }
            }
        });

        let isWhitelisted = whitelists.some(w => {
            try {
                const feats: string[] = JSON.parse(w.features);
                return feats.includes('webhook') || feats.includes('antinuke');
            } catch {
                return false;
            }
        });

        if (!isWhitelisted && log.executorId) {
            const member = await guild.members.fetch(log.executorId).catch(() => null);
            if (member) {
                const roleIds = member.roles.cache.map((r: any) => r.id);
                const roleWhitelists = await this.client.prisma.securityWhitelist.findMany({
                    where: {
                        guildId: guild.id,
                        targetId: { in: roleIds },
                        targetType: 'ROLE'
                    }
                });
                if (roleWhitelists.some((w: any) => {
                    try {
                        const feats: string[] = JSON.parse(w.features);
                        return feats.includes('webhook') || feats.includes('antinuke');
                    } catch {
                        return false;
                    }
                })) {
                    isWhitelisted = true;
                }
            }
        }

        if (isWhitelisted) return;

        // 4. Rogue Webhook Detected -> Delete all webhooks in this channel
        // Since WebhookUpdate doesn't give the specific webhook created, we fetch all and find the rogue one
        const webhooks = await channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
            if (webhook.owner?.id === log.executorId) {
                await webhook.delete('Enc Anti-Nuke: Unauthorized Webhook Injection');
                
                // Log the security stoppage in Data Core
                await AuditLogger.log(this.client, guild, {
                    type: AuditLogType.SECURITY,
                    event: 'Security Stoppage (Webhook Shield)',
                    status: AuditLogStatus.CRITICAL,
                    executorId: this.client.user?.id,
                    executorTag: this.client.user?.tag,
                    targetId: log.executorId,
                    targetName: log.executor?.tag || 'Unauthorized Executor',
                    details: `Unauthorized webhook creation detected in <#${channel.id}>. Webhook has been neutralized.`,
                    color: this.client.color.red
                });
            }
        }
    }
}
