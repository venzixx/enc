import type {
	ApplicationCommandOptionChoiceData,
	AutocompleteInteraction,
	VoiceChannel,
} from "discord.js";
import type { SearchResult } from "lavalink-client";
import { I18N, t } from "../../structures/I18n";
import { Command, Context } from "../../structures";
import { applyFairPlayToQueue } from "../../utils/functions/player";
import {
	Connect,
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	Speak,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";

export default class Play extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "play",
			description: {
				content: I18N.commands.play.description,
				examples: [
					"play example",
					"play https://www.youtube.com/watch?v=example",
					"play https://open.spotify.com/track/example",
				],
				usage: "play <song>",
			},
			category: "music",
			aliases: ["p"],
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: true,
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
			hidden: true,
			options: [
				{
					name: "song",
					description: t(I18N.commands.play.options.song),
					type: 3,
					required: true,
					autocomplete: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const query = args.join(" ");
		if (!query || query.trim().length === 0) {
			return await ctx.replyV2({
				title: `${client.emoji.cross} Missing Argument`,
				description: "Please provide a song name or URL to play!",
				isAlert: true,
				color: client.color.red,
				ephemeral: true
			});
		}
		await ctx.sendDeferMessage(ctx.locale(I18N.commands.play.loading));
		let player = client.lavalink.getPlayer(ctx.guild.id);
		const memberVoiceChannel = (ctx.member as any).voice.channel as VoiceChannel;

		if (!player)
			player = client.lavalink.createPlayer({
				guildId: ctx.guild.id,
				voiceChannelId: memberVoiceChannel.id,
				textChannelId: ctx.channel.id,
				selfMute: false,
				selfDeaf: true,
				vcRegion: memberVoiceChannel.rtcRegion!,
			});

		if (!player.connected) await player.connect();

		const isUrl = /^(https?:\/\/)/.test(query);
		const response = (await player.search(
			isUrl ? { query: query } : { query: query, source: "scsearch" },
			ctx.author,
		)) as SearchResult;
		if (!response || response.tracks?.length === 0) {
			return await ctx.editMessageV2({
                title: `${client.emoji.cross} Search Error`,
                description: ctx.locale(I18N.commands.play.errors.search_error),
                isAlert: true,
                color: this.client.config.color.red
            });
		}

		await player.queue.add(response.loadType === "playlist" ? response.tracks : response.tracks[0]);

		const fairPlayEnabled = player.get<boolean>("fairplay");
		if (fairPlayEnabled) {
			await applyFairPlayToQueue(player);
		}

		if (response.loadType === "playlist") {
			await ctx.editMessageV2({
                title: `${client.emoji.music} Playlist Added`,
                description: ctx.locale(I18N.commands.play.added_playlist_to_queue, {
                    length: response.tracks.length,
                }),
                color: this.client.config.color.main
            });
		} else {
			await ctx.editMessageV2({
                title: `${client.emoji.music} Track Added`,
                description: ctx.locale(I18N.commands.play.added_to_queue, {
                    title: response.tracks[0].info.title,
                    uri: response.tracks[0].info.uri,
                }),
                color: this.client.config.color.main
            });
		}
		if (!player.playing && player.queue.tracks.length > 0) await player.play({ paused: false });
	}

	public async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const focusedValue = interaction.options.getFocused(true);

		if (!focusedValue?.value.trim()) {
			return await interaction.respond([]);
		}

		try {
			// Hard 2.5s Timeout for Autocomplete to prevent Discord error 10062
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error("Autocomplete Timeout")), 2500)
			);
			
			const res = await Promise.race([
				this.client.lavalink.search({ query: focusedValue.value.trim() }, interaction.user),
				timeoutPromise
			]) as any;

			const songs: ApplicationCommandOptionChoiceData[] = [];

			if (res.loadType === "search") {
				res.tracks.slice(0, 10).forEach((track: any) => {
					const name = `${track.info.title} by ${track.info.author}`;
					songs.push({
						name: name.length > 100 ? `${name.substring(0, 97)}...` : name,
						value: track.info.uri,
					});
				});
			}

			return await interaction.respond(songs);
		} catch (error) {
			// Gracefully handle timeouts or search errors by responding with an empty array
			if (!interaction.responded) {
				return await interaction.respond([]).catch(() => {});
			}
		}
	}
}