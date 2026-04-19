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

export default class Volume extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "volume",
			description: {
				content: I18N.commands.volume.description,
				examples: ["volume 50", "volume 100"],
				usage: "volume <number>",
			},
			category: "music",
			aliases: ["vol", "v"],
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
					name: "number",
					description: t(I18N.commands.volume.options.number),
					type: 4,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const volume = Number.parseInt(args[0]);
		if (Number.isNaN(volume) || volume < 0 || volume > 200) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.red)
						.setDescription(ctx.locale(I18N.commands.volume.invalid_volume)),
				],
			});
		}

		await player.setVolume(volume);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.volume.volume_set, { volume })),
			],
		});
	}
}
