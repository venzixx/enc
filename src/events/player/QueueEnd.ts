import type { TextChannel } from "discord.js";
import type { Player, Track, TrackStartEvent } from "lavalink-client";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { updateSetup } from "../../utils/SetupSystem";
import { ExtendedClient } from "../../client";
import logger from "../../structures/Logger";

export default class QueueEnd extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Player,
			name: "queueEnd",
		});
	}

	public async run(player: Player, track: Track | null, _payload: TrackStartEvent): Promise<void> {
		const guild = this.client.guilds.cache.get(player.guildId);
		if (!guild) return;
		const locale = await this.client.db.getLanguage(player.guildId);

		//  Autoplay: search for a related track and keep playing
		const autoplay = player.get<boolean>("autoplay");
		if (autoplay && track) {
			try {
				const lastTrack = track;
				const searchQuery = `${lastTrack.info.title} ${lastTrack.info.author}`;
				
				const res = await this.client.lavalink.search(
					{ query: searchQuery, source: "ytsearch" },
					lastTrack.requester
				);

				if (res.loadType === "search" && res.tracks.length > 0) {
					// Pick a random track from results (skip the first to avoid repeating)
					const candidates = res.tracks.slice(1, 6);
					const pick = candidates[Math.floor(Math.random() * candidates.length)] || res.tracks[0];
					
					await player.queue.add(pick);
					if (!player.playing) await player.play({ paused: false });
					return; // Don't run cleanup  music continues
				}
			} catch (error) {
				// Autoplay failed, log and fall through to normal queue end
                logger.error(`[Lavalink] Autoplay failed in guild ${guild.id}:`, error);
			}
		}

		await updateSetup(this.client, guild, locale);

		if (player.voiceChannelId) {
			await this.client.utils.setVoiceStatus(this.client, player.voiceChannelId, "");
		}

		const messageId = player.get<string | undefined>("messageId");
		if (!messageId) return;

		const channel = guild.channels.cache.get(player.textChannelId!) as TextChannel;
		if (!channel) return;

		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) return;

		if (message.editable) {
			await message.edit({ components: [] }).catch(() => {});
		}
	}
}

