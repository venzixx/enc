import { Command, Context } from "../../structures";
import {
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";

export default class Ping extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ping",
			description: {
				content: "Check bot latency and system status",
				examples: ["ping"],
				usage: "ping",
			},
			category: "general",
			aliases: ["pong"],
			cooldown: 3,
			args: false,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: [
					SendMessages,
					ReadMessageHistory,
					ViewChannel,
					EmbedLinks,
				],
				user: [],
			},
			slashCommand: true,
			options: [],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		// Defer for both slash and prefix
		await ctx.deferReply();

		const wsPing = client.ws.ping;
		let nodePing = "N/A";

		try {
			const player = client.lavalink.getPlayer(ctx.guild.id);
			if (player && player.queue.current) {
				const node = player.node;
				if (node && (node as any).heartBeatPing !== undefined) {
					nodePing = `${(node as any).heartBeatPing}ms`;
				}
			}
		} catch {
			// Ignore player fetch errors
		}

		const color = this.client.color.main;
		const uptime = `${Math.floor(client.uptime! / 86400000)}d ${Math.floor(client.uptime! / 3600000) % 24}h ${Math.floor(client.uptime! / 60000) % 60}m`;

		return await ctx.replyV2({
			title: `**System Heartbeat**`,
			description: `Detailed diagnostics and latency benchmarks for **${client.user?.username}**.`,
			media: 'https://i.imgur.com/u8M0C0F.png', // Premium pulse banner
			fields: [
				{
					name: `${client.emoji.info} **API LATENCY**`,
					value: `> \`${wsPing}ms\` (Discord API)`,
					inline: true
				},
				{
					name: `${client.emoji.info} **REST LATENCY**`,
					value: `> \`${wsPing}ms\` (Message Loop)`,
					inline: true
				},
				{
					name: `${client.emoji.music} **LAVALINK**`,
					value: `> \`${nodePing}\` (Voice Node)`,
					inline: true
				},
				{
					name: `${client.emoji.edit} **ENVIRONMENT**`,
					value: `> \`NodeJS ${process.version}\` \u2022 \`Up ${uptime}\``,
					inline: false
				}
			],
			color: color,
			footer: `Diagnostic complete \u2022 Monochromatic V2 Engine`
		});
	}
}
