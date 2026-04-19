import { type ColorResolvable } from "discord.js";
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
import type { Requester } from "../../types";
import { V2Helper } from "../../utils/V2Helper";


export default class Nowplaying extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "nowplaying",
			description: {
				content: I18N.commands.nowplaying.description,
				examples: ["nowplaying"],
				usage: "nowplaying",
			},
			category: "music",
			aliases: ["np"],
			cooldown: 3,
			args: false,
			vote: false,
			player: {
				voice: true,
				dj: false,
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
		if (!player || !player.queue.current) {
            return await ctx.sendV2({
                title: `${client.emoji.music} Player Idle`,
                description: "There is nothing currently playing in this server.",
                isAlert: true,
                color: client.color.main,
                ephemeral: true
            });
        }

		const track = player.queue.current;
		const locale = await this.client.db.getLanguage(ctx.guild.id);

		return await ctx.sendV2({
            title: ctx.locale(I18N.player.trackStart.now_playing),
            description: `**[${track.info.title}](${track.info.uri})**\n` +
                         `-# ${ctx.locale(I18N.player.trackStart.author)}: ${track.info.author}\n` +
                         `-# ${ctx.locale(I18N.player.trackStart.duration)}: ${track.info.isStream ? "LIVE" : this.client.utils.formatTime(track.info.duration)}\n` +
                         `-# ${ctx.locale(I18N.player.trackStart.requested_by, { user: (track.requester as Requester).username })}`,
            color: this.client.config.color.main as ColorResolvable,
            thumbnail: track.info.artworkUrl || undefined
        });
	}
}

