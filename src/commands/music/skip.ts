import { I18N } from "../../structures/I18n";
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

export default class Skip extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "skip",
			description: {
				content: I18N.commands.skip.description,
				examples: ["skip"],
				usage: "skip",
			},
			category: "music",
			aliases: ["s", "next"],
			cooldown: 3,
			args: false,
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
			options: [],
		});
	}

	public async run(client: ExtendedClient, ctx: Context): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		if (player.queue.tracks.length === 0 && !player.get("autoplay")) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.player.trackStart.no_more_songs_in_queue)),
				],
			});
		}

		await player.skip();

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.skip.skipped)),
			],
		});
	}
}
