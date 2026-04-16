import { I18N } from "../../structures/I18n";
import { Command, Context } from "../../structures";
import { applyFairPlayToQueue } from "../../utils/functions/player";
import {
	Connect,
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	Speak,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";

export default class FairPlay extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "fairplay",
			description: {
				content: I18N.commands.fairplay.description,
				examples: ["fairplay"],
				usage: "fairplay",
			},
			category: "music",
			aliases: ["fp"],
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

		const fairplay = player.get<boolean>("fairplay");
		player.set("fairplay", !fairplay);

        if (!fairplay) {
            await applyFairPlayToQueue(player);
        }

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(fairplay ? I18N.commands.fairplay.messages.disabled : I18N.commands.fairplay.messages.enabled)),
			],
		});
	}
}
