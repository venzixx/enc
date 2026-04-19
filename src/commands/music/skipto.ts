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

export default class Skipto extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "skipto",
			description: {
				content: I18N.commands.skipto.description,
				examples: ["skipto 5"],
				usage: "skipto <index>",
			},
			category: "music",
			aliases: ["st"],
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
			slashCommand: false,
			hidden: true,
			options: [
				{
					name: "duration",
					description: t(I18N.commands.seek.options.duration),
					type: 3,
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
						.setDescription(ctx.locale(I18N.commands.skipto.invalid_index)),
				],
			});
		}

		await player.queue.splice(0, index - 1);
		await player.skip();

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.skipto.skipped, { index })),
			],
		});
	}
}
