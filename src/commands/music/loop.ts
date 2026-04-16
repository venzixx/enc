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

export default class Loop extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "loop",
			description: {
				content: I18N.commands.loop.description,
				examples: ["loop", "loop track", "loop queue", "loop off"],
				usage: "loop [mode]",
			},
			category: "music",
			aliases: ["repeat"],
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
			options: [
				{
					name: "mode",
					description: t(I18N.commands.loop.options.mode),
					type: 3,
					required: false,
					choices: [
						{ name: "Off", value: "off" },
						{ name: "Track", value: "track" },
						{ name: "Queue", value: "queue" },
					],
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		let mode = args[0]?.toLowerCase();
		if (!mode) {
			mode = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
		}

		if (!["off", "track", "queue"].includes(mode)) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.commands.loop.invalid_mode)),
				],
			});
		}

		await player.setRepeatMode(mode as "off" | "track" | "queue");

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.loop.set, { mode })),
			],
		});
	}
}
