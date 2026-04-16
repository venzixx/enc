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

export default class Move extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "move",
			description: {
				content: I18N.commands.move.description,
				examples: ["move 5 1"],
				usage: "move <from> <to>",
			},
			category: "music",
			aliases: ["mv"],
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
					name: "from",
					description: t(I18N.commands.move.options.from),
					type: 4,
					required: true,
				},
				{
					name: "to",
					description: t(I18N.commands.move.options.to),
					type: 4,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const from = Number.parseInt(args[0]);
		const to = Number.parseInt(args[1]);

		if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < 1 || 
            from > player.queue.tracks.length || to > player.queue.tracks.length) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.commands.move.invalid_index)),
				],
			});
		}

		const track = player.queue.tracks[from - 1];
		await player.queue.splice(from - 1, 1);
		await player.queue.splice(to - 1, 0, track);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.move.moved, { title: track.info.title, from, to })),
			],
		});
	}
}
