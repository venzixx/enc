import { EmbedBuilder, type ColorResolvable } from "discord.js";
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

export default class Queue extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "queue",
			description: {
				content: I18N.commands.queue.description,
				examples: ["queue"],
				usage: "queue",
			},
			category: "music",
			aliases: ["q"],
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
			slashCommand: true,
			options: [],
		});
	}

	public async run(client: ExtendedClient, ctx: Context): Promise<any> {
		const player = client.lavalink.getPlayer(ctx.guild.id);
		if (!player) return;

		const queue = player.queue.tracks;

		if (queue.length === 0) {
			return await ctx.sendMessage({
				embeds: [
					this.client.embed()
						.setColor(this.client.config.color.main as ColorResolvable)
						.setDescription(ctx.locale(I18N.player.errors.queue_empty)),
				],
			});
		}

		const tracks = queue.slice(0, 10).map((track: any, i: number) => {
			return `\`${i + 1}.\` [${track.info.title}](${track.info.uri}) - \`${client.utils.formatTime(track.info.duration || 0)}\``;
		});

		const totalDuration = queue.reduce((acc: number, track: any) => acc + (track.info.duration || 0), 0);

		const embed = new EmbedBuilder()
			.setTitle(ctx.locale(I18N.commands.queue.title, { guild: ctx.guild.name }))
			.setDescription(tracks.join("\n"))
			.setFooter({
				text: ctx.locale(I18N.commands.queue.duration, { 
                    duration: client.utils.formatTime(totalDuration)
                }),
			})
			.setColor(this.client.config.color.main as ColorResolvable);

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
