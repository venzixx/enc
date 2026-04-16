import { Events, GuildChannel, AuditLogEvent } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { AntiNukeTracker } from "../../utils/AntiNukeTracker";

export default class AntiNukeChannelDelete extends Event {
    constructor(client: ExtendedClient, file: string) {
        super(client, file, {
            type: LavamusicEventType.Client,
            name: Events.ChannelDelete,
        });
    }

    public async run(channel: GuildChannel): Promise<void> {
        const guild = channel.guild;
        if (!guild) return;

        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelDelete,
        }).catch(() => null);

        const log = auditLogs?.entries.first();
        if (!log || !log.executorId || log.executorId === this.client.user?.id) return;

        await AntiNukeTracker.track(this.client, guild, log.executorId, 'antiNukeChannel');
    }
}
