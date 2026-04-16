import { Events, GuildBan, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { AntiNukeTracker } from "../../utils/AntiNukeTracker";

export default class GuildBanAdd extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.GuildBanAdd,
        });
    }

    public async run(ban: GuildBan): Promise<void> {
        const guild = ban.guild;
        if (!guild) return;

        // Fetch audit logs to see who performed the ban
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanAdd,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId) return;

        // Don't track if the bot itself did the ban (e.g. via moderation commands)
        if (log.executorId === this.client.user?.id) return;

        await AntiNukeTracker.track(this.client, guild, log.executorId, 'antiNukeBan');
    }
}
