import { Command, Context } from "../../structures";
import {
	Connect,
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	Speak,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";

export default class Lyrics extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "lyrics",
			description: {
				content: "Get the lyrics for the currently playing song or a specific song",
				examples: ["lyrics", "lyrics Never Gonna Give You Up"],
				usage: "lyrics [song name]",
			},
			category: "music",
			aliases: ["ly"],
			cooldown: 5,
			args: false,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: [SendMessages, ReadMessageHistory, ViewChannel, EmbedLinks, Connect, Speak],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: "song",
					description: "The song to search lyrics for (leave empty for currently playing)",
					type: 3, // STRING
					required: false,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();

		let searchTitle = "";
		let searchArtist = "";

		// Check if user provided a song name
		const query = ctx.options.getString("song", 0) || args.join(" ");

		if (query) {
			searchTitle = query;
		} else {
			// Try to get from currently playing track
			const player = client.lavalink.getPlayer(ctx.guild.id);
			const currentTrack = player?.queue?.current;

			if (!currentTrack) {
				return await ctx.editReply({
					embeds: [
						client.embed()
							.setColor(client.color.red)
							.setDescription("❌ Nothing is playing right now. Provide a song name: `/lyrics <song>`")
					],
				});
			}

			searchTitle = currentTrack.info.title;
			searchArtist = currentTrack.info.author;
		}

		try {
			// Search using lrclib.net (free, no API key needed)
			const cleanTitle = searchTitle
				.replace(/\(.*?\)/g, "")    // Remove parenthetical info
				.replace(/\[.*?\]/g, "")    // Remove bracketed info
				.replace(/official\s*(music\s*)?video/gi, "")
				.replace(/lyrics?\s*video/gi, "")
				.replace(/audio/gi, "")
				.replace(/ft\.?\s*.*/gi, "")
				.trim();

			const searchParam = searchArtist 
				? `artist_name=${encodeURIComponent(searchArtist)}&track_name=${encodeURIComponent(cleanTitle)}`
				: `track_name=${encodeURIComponent(cleanTitle)}`;

			// Try exact match first
			let response = await fetch(`https://lrclib.net/api/get?${searchParam}`);
			let data: any = null;

			if (response.ok) {
				data = await response.json();
			}

			// Fallback to search
			if (!data || (!data.plainLyrics && !data.syncedLyrics)) {
				const searchResponse = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
				if (searchResponse.ok) {
					const results = await searchResponse.json();
					if (Array.isArray(results) && results.length > 0) {
						data = results[0];
					}
				}
			}

			if (!data || (!data.plainLyrics && !data.syncedLyrics)) {
				return await ctx.editReply({
					embeds: [
						client.embed()
							.setColor(client.color.red)
							.setDescription(`❌ No lyrics found for **${searchTitle}**`)
					],
				});
			}

			// Use plain lyrics (strip sync timestamps if using synced)
			let lyrics = data.plainLyrics || data.syncedLyrics?.replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, "") || "No lyrics available.";

			// Discord embed description limit is 4096 characters
			if (lyrics.length > 3900) {
				lyrics = lyrics.substring(0, 3900) + "\n\n... **(lyrics truncated)**";
			}

			const embed = client.embed()
				.setColor(client.color.main)
				.setTitle(`🎤 ${data.trackName || searchTitle}`)
				.setDescription(lyrics)
				.setFooter({ text: `Artist: ${data.artistName || searchArtist || "Unknown"} • Powered by LRCLIB` })
				.setTimestamp();

			return await ctx.editReply({ embeds: [embed] });
		} catch (error) {
			return await ctx.editReply({
				embeds: [
					client.embed()
						.setColor(client.color.red)
						.setDescription(`❌ Failed to fetch lyrics for **${searchTitle}**`)
				],
			});
		}
	}
}
