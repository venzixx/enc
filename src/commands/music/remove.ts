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

export default class Remove extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "remove",
			description: {
				content: I18N.commands.remove.description,
				examples: ["remove 1"],
				usage: "remove <index>",
			},
			category: "music",
			aliases: ["rm"],
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
					name: "index",
					description: t(I18N.commands.remove.options.index),
					type: 4,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const index = Number.parseInt(args[0]);
		if (Number.isNaN(index) || index < 1 || index > player.queue.tracks.length) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.commands.remove.invalid_index)),
				],
			});
		}

		const track = player.queue.tracks[index - 1];
		await player.queue.remove(index - 1);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.remove.removed, { title: track.info.title })),
			],
		});
	}
}
