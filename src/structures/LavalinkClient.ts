import { LavalinkManager } from "lavalink-client";
import { ExtendedClient } from "../client";

export class LavalinkClient extends LavalinkManager {
	public client: ExtendedClient;

	constructor(client: ExtendedClient) {
		// @ts-ignore - The types for lavalink-client have changed in recent versions
		super({
			nodes: client.config.nodes.map((node: any) => ({
                id: node.id || node.host,
                host: node.host,
                port: Number(node.port),
                authorization: node.authorization || node.password || node.pass,
                secure: node.secure === "true" || node.secure === true,
                retryAmount: node.retryAmount || 50,
                retryDelay: node.retryDelay || 5000,
            })),
			sendToShard: (guildId: any, payload: any) => {
				const guild = client.guilds.cache.get(guildId);
				if (guild) guild.shard.send(payload);
			},
			autoSkip: true,
			playerOptions: {
				clientData: {
					name: client.user?.username || "Enc",
				},
			} as any,
		} as any);
		this.client = client;
	}

	public async search(query: string | { query: string; source?: string }, user: any) {
		const searchEngine = process.env.SEARCH_ENGINE || "youtube";
		let searchQuery: any = query;

		if (typeof query === "string") {
			const isUrl = /^(https?:\/\/)/.test(query);
			searchQuery = {
				query: isUrl ? query : query,
				source: isUrl ? undefined : searchEngine,
			};
		} else if (typeof query === "object" && query.query) {
			const isUrl = /^(https?:\/\/)/.test(query.query);
			if (!isUrl && !query.source) {
				searchQuery.source = searchEngine;
			}
		}

		let lastError: any;
		const nodes = this.nodeManager.leastUsedNodes();
		if (!nodes || nodes.length === 0) throw new Error("No available Lavalink nodes");

		// Attempt search on multiple nodes if necessary to bypass localized timeouts
		for (const node of nodes.slice(0, 2)) {
			try {
				return await node.search(searchQuery, user);
			} catch (error: any) {
				lastError = error;
				if (error.name === "TimeoutError" || error.message?.includes("aborted")) {
					continue; // Try next node
				}
				throw error; // Re-throw if it's a fatal error
			}
		}
		throw lastError;
	}
}

