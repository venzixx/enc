import { Events } from "discord.js";
import { env } from "../../env";
import { Event } from "../../structures";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";
import { startGiveawayScheduler } from "../../tasks/giveawayScheduler";


export default class Ready extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: Events.ClientReady,
		});
	}

	public async run(): Promise<void> {
		logger.success(`${this.client.user?.tag} is ready!`);
		await startGiveawayScheduler(this.client);

		this.client.user?.setPresence({
			activities: [
				{
					name: env.BOT_ACTIVITY || "Music",
					type: Number(env.BOT_ACTIVITY_TYPE) || 0,
					url: env.STREAMING_URL || undefined,
				},
			],
			status: (env.BOT_STATUS as any) || "online",

		});

		await this.client.lavalink.init({ ...this.client.user!, shards: "auto" });

		// Initialize invite cache
		for (const guild of this.client.guilds.cache.values()) {
			try {
				const invites = await guild.invites.fetch();
				const inviteCache = new Map<string, number>();
				invites.forEach(inv => inviteCache.set(inv.code, inv.uses || 0));
				this.client.invites.set(guild.id, inviteCache as any);
			} catch (err) {
				logger.error(`Failed to cache invites for guild ${guild.id}:`, err);
			}
		}
	}
}
