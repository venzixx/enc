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

export default class Autoplay extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "autoplay",
			description: {
				content: I18N.commands.autoplay.description,
				examples: ["autoplay"],
				usage: "autoplay",
			},
			category: "music",
			aliases: ["auto"],
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
			slashCommand: false,
			hidden: true,
			options: [],
		});
	}

	public async run(client: ExtendedClient, ctx: Context): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const autoplay = player.get<boolean>("autoplay");
		player.set("autoplay", !autoplay);

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(autoplay ? I18N.autoplay.messages.disabled : I18N.autoplay.messages.enabled)),
			],
		});
	}
}

