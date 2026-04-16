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

export default class PlayNext extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "playnext",
			description: {
				content: I18N.commands.playnext.description,
				examples: ["playnext sidemen"],
				usage: "playnext <query>",
			},
			category: "music",
			aliases: ["pn"],
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: true,
				dj: true,
				active: true,
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
					description: t(I18N.commands.playnext.options.query),
					type: 3,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const query = args.join(" ");
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const res = await player.search({ query }, ctx.author);

		if (res.loadType === "empty" || res.loadType === "error") {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.player.setupStart.error_searching)),
				],
			});
		}

		if (res.loadType === "playlist") {
			await player.queue.splice(0, 0, ...res.tracks);
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.main)
						.setDescription(
							ctx.locale(I18N.player.setupStart.added_playlist_to_queue, {
								length: res.tracks.length,
							}),
						),
				],
			});
		}

		await player.queue.splice(0, 0, res.tracks[0]);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(
						ctx.locale(I18N.player.setupStart.added_to_queue, {
							title: res.tracks[0].info.title,
							uri: res.tracks[0].info.uri,
						}),
					),
			],
		});
	}
}
