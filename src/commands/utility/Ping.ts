import { Command, Context } from "../../structures";
import {
	EmbedLinks,
	ReadMessageHistory,
	SendMessages,
	ViewChannel,
} from "../../utils/Permissions";
import { ExtendedClient } from "../../client";
import { ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";

export default class Ping extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ping",
			description: {
				content: "Check bot latency, database response time, and system health in real-time",
				examples: ["ping"],
				usage: "ping",
			},
			category: "utility",
			aliases: ["p", "pong", "latency"],
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

	private getLatencyStatus(ms: number): { emoji: string; status: string } {
		if (ms < 0 || isNaN(ms)) return { emoji: '⚪', status: 'Unknown' };
		if (ms < 100) return { emoji: '🟢', status: 'Excellent' };
		if (ms < 250) return { emoji: '🟡', status: 'Moderate' };
		return { emoji: '🔴', status: 'High' };
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const startRest = Date.now();
		if (!ctx.deferred && !ctx.replied) {
			await ctx.deferReply();
		}
		const restLatency = Date.now() - startRest;

		// 1. Database Latency Benchmark
		let dbLatency = -1;
		try {
			const dbStart = Date.now();
			await client.prisma.$queryRaw`SELECT 1`;
			dbLatency = Date.now() - dbStart;
		} catch {
			dbLatency = -1;
		}

		// 2. WebSocket Latency
		const wsPing = client.ws.ping;

		// 3. Lavalink Voice Node Latency
		let lavalinkPingStr = "N/A";
		let lavalinkMs = -1;
		try {
			const player = client.lavalink?.getPlayer(ctx.guild?.id || '');
			if (player && player.node) {
				const ping = (player.node as any).heartBeatPing ?? -1;
				if (ping !== -1) {
					lavalinkMs = ping;
					lavalinkPingStr = `${ping}ms`;
				} else {
					lavalinkPingStr = "Connected";
				}
			} else {
				const nodes = client.lavalink?.nodeManager?.nodes;
				if (nodes && nodes.size > 0) {
					const firstNode = nodes.values().next().value;
					const ping = (firstNode as any)?.heartBeatPing ?? -1;
					if (ping !== -1) {
						lavalinkMs = ping;
						lavalinkPingStr = `${Math.round(ping)}ms`;
					} else {
						lavalinkPingStr = "Online";
					}
				}
			}
		} catch {
			lavalinkPingStr = "N/A";
		}

		// 4. Memory & System Stats
		const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
		const uptime = `${Math.floor(client.uptime! / 86400000)}d ${Math.floor(client.uptime! / 3600000) % 24}h ${Math.floor(client.uptime! / 60000) % 60}m`;

		const wsStatus = this.getLatencyStatus(wsPing);
		const restStatus = this.getLatencyStatus(restLatency);
		const dbStatus = this.getLatencyStatus(dbLatency);

		const customId = `ping_ref_${ctx.author.id}_${Date.now()}`;
		const refreshButton = new ButtonBuilder()
			.setCustomId(customId)
			.setLabel('Benchmark Again')
			.setEmoji(client.emoji.loading_spinner.match(/\d+/)?.[0] || '🔄')
			.setStyle(ButtonStyle.Secondary);

		await ctx.replyV2({
			title: `${client.emoji.ping_bolt} System Latency & Performance Diagnostics`,
			description: `Real-time responsiveness metrics for **${client.user?.username}**.`,
			fields: [
				{
					name: `${wsStatus.emoji} WEBSOCKET GATEWAY`,
					value: `\`\`\`yaml\nLatency: ${wsPing}ms\nStatus: ${wsStatus.status}\n\`\`\``,
					inline: true
				},
				{
					name: `${restStatus.emoji} REST API ROUNDTRIP`,
					value: `\`\`\`yaml\nLatency: ${restLatency}ms\nStatus: ${restStatus.status}\n\`\`\``,
					inline: true
				},
				{
					name: `${dbStatus.emoji} DATABASE (PRISMA)`,
					value: `\`\`\`yaml\nLatency: ${dbLatency >= 0 ? `${dbLatency}ms` : 'Offline'}\nStatus: ${dbStatus.status}\n\`\`\``,
					inline: true
				},
				{
					name: `${client.emoji.music} AUDIO ENGINE (LAVALINK)`,
					value: `\`\`\`yaml\nNode Ping: ${lavalinkPingStr}\nStatus: ${lavalinkMs >= 0 ? this.getLatencyStatus(lavalinkMs).status : 'Standby'}\n\`\`\``,
					inline: true
				},
				{
					name: `${client.emoji.system_cpu} SYSTEM RESOURCE USAGE`,
					value: `\`\`\`yaml\nMemory: ${memoryUsage} MB\nUptime: ${uptime}\nRuntime: Node ${process.version}\n\`\`\``,
					inline: true
				}
			],
			buttons: [refreshButton],
			color: client.color.main,
			footer: `Last Benchmark • ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST`
		});

		if (!ctx.channel) return;

		// Button Collector for live refresh
		const collector = ctx.channel.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (i) => i.customId === customId,
			time: 60000
		});

		collector.on('collect', async (i: any) => {
			if (i.user.id !== ctx.author.id) {
				return i.reply({ content: '❌ Only the command invoker can refresh this diagnostic.', ephemeral: true });
			}

			await i.deferUpdate();

			const newStart = Date.now();
			let newDbLatency = -1;
			try {
				const dbStart = Date.now();
				await client.prisma.$queryRaw`SELECT 1`;
				newDbLatency = Date.now() - dbStart;
			} catch {
				newDbLatency = -1;
			}

			const newWsPing = client.ws.ping;
			const newRestLatency = Date.now() - newStart;

			let newLavalinkStr = "N/A";
			let newLavalinkMs = -1;
			try {
				const player = client.lavalink?.getPlayer(ctx.guild?.id || '');
				if (player && player.node) {
					const ping = (player.node as any).heartBeatPing ?? -1;
					if (ping !== -1) {
						newLavalinkMs = ping;
						newLavalinkStr = `${ping}ms`;
					}
				}
			} catch {}

			const newMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
			const newUptime = `${Math.floor(client.uptime! / 86400000)}d ${Math.floor(client.uptime! / 3600000) % 24}h ${Math.floor(client.uptime! / 60000) % 60}m`;

			const nWsStatus = this.getLatencyStatus(newWsPing);
			const nRestStatus = this.getLatencyStatus(newRestLatency);
			const nDbStatus = this.getLatencyStatus(newDbLatency);

			await ctx.editReplyV2({
				title: `⚡ System Latency & Performance Diagnostics`,
				description: `Real-time responsiveness metrics for **${client.user?.username}**.`,
				fields: [
					{
						name: `${nWsStatus.emoji} **WEBSOCKET GATEWAY**`,
						value: `\`\`\`yaml\nLatency: ${newWsPing}ms\nStatus: ${nWsStatus.status}\n\`\`\``,
						inline: true
					},
					{
						name: `${nRestStatus.emoji} **REST API ROUNDTRIP**`,
						value: `\`\`\`yaml\nLatency: ${newRestLatency}ms\nStatus: ${nRestStatus.status}\n\`\`\``,
						inline: true
					},
					{
						name: `${nDbStatus.emoji} **DATABASE (PRISMA)**`,
						value: `\`\`\`yaml\nLatency: ${newDbLatency >= 0 ? `${newDbLatency}ms` : 'Offline'}\nStatus: ${nDbStatus.status}\n\`\`\``,
						inline: true
					},
					{
						name: `🎵 **AUDIO ENGINE (LAVALINK)**`,
						value: `\`\`\`yaml\nNode Ping: ${newLavalinkStr}\nStatus: ${newLavalinkMs >= 0 ? this.getLatencyStatus(newLavalinkMs).status : 'Standby'}\n\`\`\``,
						inline: true
					},
					{
						name: `💻 **SYSTEM RESOURCE USAGE**`,
						value: `\`\`\`yaml\nMemory: ${newMem} MB\nUptime: ${newUptime}\nRuntime: Node ${process.version}\n\`\`\``,
						inline: true
					}
				],
				buttons: [refreshButton],
				color: client.color.main,
				footer: `Last Benchmark • ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST`
			});
		});

		collector.on('end', async () => {
			try {
				const disabledButton = ButtonBuilder.from(refreshButton).setDisabled(true);
				await ctx.editReplyV2({
					buttons: [disabledButton]
				});
			} catch {}
		});
	}
}
