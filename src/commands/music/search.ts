import {
	ActionRowBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	type StringSelectMenuInteraction,
    type ColorResolvable,
} from "discord.js";
import { I18N, t } from "../../structures/I18n";
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

export default class Search extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "search",
			description: {
				content: I18N.commands.search.description,
				examples: ["search sidemen", "search owl city"],
				usage: "search <query>",
			},
			category: "music",
			aliases: ["find"],
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
			options: [
				{
					name: "query",
					description: t(I18N.commands.play.options.song),
					type: 3,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const query = args.join(" ");

		let player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) {
			player = client.lavalink.createPlayer({
				guildId: ctx.guild.id,
				voiceChannelId: (ctx.member as any).voice.channelId!,
				textChannelId: ctx.channelId,
				selfDeaf: true,
				selfMute: false,
			});
		}

		if (!player.connected) await player.connect();

		const res = await (player as any).search({ query }, ctx.author);

		if (res.loadType === "empty" || res.loadType === "error") {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red as ColorResolvable)
						.setDescription(ctx.locale(I18N.player.setupStart.error_searching)),
				],
			});
		}

		if (res.loadType === "playlist") {
			await player.queue.add(res.tracks);
			if (!player.playing) await player.play();
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.main as ColorResolvable)
						.setDescription(
							ctx.locale(I18N.player.setupStart.added_playlist_to_queue, {
								length: res.tracks.length,
							}),
						),
				],
			});
		}

		const tracks = res.tracks.slice(0, 10);
		const embed = new EmbedBuilder()
			.setColor(this.client.config.color.main as ColorResolvable)
			.setTitle(ctx.locale(I18N.commands.search.messages.results_found, { count: tracks.length }))
			.setDescription(
				tracks.map((track: any, i: number) => `\`${i + 1}.\` [${track.info.title}](${track.info.uri})`).join("\n"),
			);

		const menu = new StringSelectMenuBuilder()
			.setCustomId("search_menu")
			.setPlaceholder(ctx.locale(I18N.commands.search.select))
			.addOptions(
				tracks.map((track: any, i: number) => ({
					label: (track.info.title || "Unknown").slice(0, 100),
					value: i.toString(),
					description: (track.info.author || "Unknown").slice(0, 100),
				})),
			);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

		const msg: any = await ctx.sendMessage({ embeds: [embed], components: [row] });
        if (!msg) return;

		const filter = (i: StringSelectMenuInteraction) => i.user.id === ctx.author.id;
		const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

		collector.on("collect", async (i: StringSelectMenuInteraction) => {
			if (i.customId === "search_menu") {
				const track = tracks[Number.parseInt(i.values[0])];
				await player!.queue.add(track);
				if (!player!.playing) await player!.play();
				await i.update({
					embeds: [
						this.client.embed()
							.setColor(this.client.config.color.main as ColorResolvable)
							.setDescription(
								ctx.locale(I18N.player.setupStart.added_to_queue, {
									title: track.info.title,
									uri: track.info.uri,
								}),
							),
					],
					components: [],
				});
				collector.stop();
			}
		});

		collector.on("end", async (collected: any, reason: string) => {
			if (reason === "time" && collected.size === 0) {
				await msg.edit({ components: [] }).catch(() => {});
			}
		});
	}
}
