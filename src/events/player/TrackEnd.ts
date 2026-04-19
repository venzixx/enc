import type { TextChannel } from "discord.js";
import type { Player, Track, TrackStartEvent } from "lavalink-client";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { updateSetup } from "../../utils/SetupSystem";
import { ExtendedClient } from "../../client";
import logger from "../../structures/Logger";

export default class TrackEnd extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Player,
			name: "trackEnd",
		});
	}

	public async run(player: Player, _track: Track | null, _payload: any): Promise<void> {
		const guild = this.client.guilds.cache.get(player.guildId);
		if (!guild) return;

		const locale = await this.client.db.getLanguage(player.guildId);
		await updateSetup(this.client, guild, locale);

        // Failover Logic for Premature Ends (YouTube Throttling)
        const track = _track;
        const payload = _payload as any; // Cast to access 'reason'
        const startTime = player.get<number>("startTime") || 0;
        const elapsedTime = Date.now() - startTime;

        const reason = payload?.reason?.toUpperCase() || payload?.type?.toUpperCase() || "UNKNOWN";

        logger.info(`[Lavalink] Track End in guild ${player.guildId}: ${track?.info?.title || 'Unknown'} | Reason: ${reason} | Played: ${elapsedTime}ms | Duration: ${track?.info?.duration}ms`);

        if (track?.info?.sourceName === "youtube" && 
            (reason === "FINISHED" || reason === "LOAD_FAILED") && 
            elapsedTime < 25000 && // Ended in less than 25 seconds
            track.info.duration > 60000 // Was supposed to be longer than a minute
        ) {
            logger.warn(`[Lavalink] Premature track end detected for ${track.info.title} in ${player.guildId}. Payload: ${payload.reason}. Duration: ${elapsedTime}ms. Triggering failover...`);
            
            const channel = guild.channels.cache.get(player.textChannelId!) as any;
            if (channel) channel.send(`${this.client.emoji.exclamation} YouTube interrupted the stream early. Switching to an alternative source...`).catch(() => {});

            try {
                const res = await this.client.lavalink.search({ query: track.info.title, source: "scsearch" }, track.requester);
                if (res && res.tracks.length > 0) {
                    player.queue.add(res.tracks[0], 0); // Insert at start
                    player.skip();
                    return;
                }
            } catch (err) {
                logger.error(`[Lavalink] TrackEnd failover search failed:`, err);
            }
        }

		const messageId = player.get<string | undefined>("messageId");
		if (!messageId) return;

		const channel = guild.channels.cache.get(player.textChannelId!) as TextChannel;
		if (!channel) return;

		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) return;

		await message.delete().catch(() => {});
	}
}
