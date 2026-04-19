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

export default class Seek extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "seek",
			description: {
				content: I18N.commands.seek.description,
				examples: ["seek 1m 30s"],
				usage: "seek <duration>",
			},
			category: "music",
			aliases: [],
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

		const duration = client.utils.parseTime(args.join(" "));
		if (duration === null) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.commands.seek.invalid_time)),
				],
			});
		}

		if (duration > player.queue.current!.info.duration) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(
							ctx.locale(I18N.commands.seek.errors.beyond_duration, {
								length: client.utils.formatTime(player.queue.current!.info.duration),
							}),
						),
				],
			});
		}

		await player.seek(duration);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(
						ctx.locale(I18N.commands.seek.seeked, {
							duration: client.utils.formatTime(duration),
						}),
					),
			],
		});
	}
}
