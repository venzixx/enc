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

export default class Leave extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "leave",
			description: {
				content: I18N.commands.leave.description,
				examples: ["leave"],
				usage: "leave",
			},
			category: "music",
			aliases: ["disconnect", "dc"],
			cooldown: 3,
			args: false,
			vote: false,
			player: {
				voice: true,
				dj: true,
				active: false,
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
		if (player) {
            await player.destroy();
        } else {
            const member = await ctx.guild.members.fetch(client.user!.id).catch(() => null);
            if (member?.voice.channelId) {
                await member.voice.disconnect();
            }
        }

		return await ctx.sendMessage({
			embeds: [
				this.client.embed()
					.setColor(this.client.config.color.main)
					.setDescription(ctx.locale(I18N.commands.leave.left, { channelId: ctx.memberVoiceChannel?.id || "unknown" })),
			],
		});

	}
}
