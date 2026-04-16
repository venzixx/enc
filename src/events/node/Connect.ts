import type { LavalinkNode } from "lavalink-client";
import { Event } from "../../structures";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class Connect extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Node,
			name: "connect",
		});
	}

	public async run(node: LavalinkNode): Promise<void> {
		logger.success(`Node ${node.id} is ready!`);

		const data = await this.client.db.get_247();
		if (!data || !Array.isArray(data)) return;

		data.forEach((main: any, index: number) => {
			setTimeout(async () => {
				const guildId = main.id || main.guildId;
                if (!guildId) return;
                
				const guild = this.client.guilds.cache.get(guildId);
				if (!guild) return;

				const channelId = main.stay247TextChannel || main.textId;
				const voiceId = main.stay247VoiceChannel || main.voiceId;

				if (channelId && voiceId) {
					try {
						const player = this.client.lavalink.createPlayer({
							guildId: guild.id,
							voiceChannelId: voiceId,
							textChannelId: channelId,
							selfDeaf: true,
							selfMute: false,
						});
						if (!player.connected) await player.connect();
					} catch (error) {
						logger.error(`Failed to create queue for guild ${guild.id}: ${error}`);
					}
				}
			}, index * 1000);
		});
	}
}
