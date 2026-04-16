import { Events, Webhook, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

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
                whitelistedUsers: true
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
        const isWhitelisted = guildData.whitelistedUsers.some(wu => wu.userId === log.executorId);

        if (isOwner || isExtraOwner || isWhitelisted) return;

        // 4. Rogue Webhook Detected -> Delete all webhooks in this channel
        // Since WebhookUpdate doesn't give the specific webhook created, we fetch all and find the rogue one
        const webhooks = await channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
            if (webhook.owner?.id === log.executorId) {
                await webhook.delete('Enc Anti-Nuke: Unauthorized Webhook Injection');
            }
        }
    }
}
