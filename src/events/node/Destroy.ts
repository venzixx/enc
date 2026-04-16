import type { LavalinkNode } from "lavalink-client";
import { Event } from "../../structures";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class Destroy extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Node,
			name: "destroy",
		});
	}

	public async run(node: LavalinkNode): Promise<void> {
		logger.warn(`Node ${node.id} was destroyed!`);
	}
}
