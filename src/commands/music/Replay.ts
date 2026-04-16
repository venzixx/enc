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

export default class Replay extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "replay",
			description: {
				content: I18N.commands.replay.description,
				examples: ["replay"],
				usage: "replay",
			},
			category: "music",
			aliases: ["rp"],
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

		await player.seek(0);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.replay.replaying)),
			],
		});
	}
}
