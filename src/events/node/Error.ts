import type { LavalinkNode } from "lavalink-client";
import { Event } from "../../structures";
import logger from "../../structures/Logger";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class Error extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Node,
			name: "error",
		});
	}

	public async run(node: LavalinkNode, error: any): Promise<void> {
		logger.error(`Node ${node.id} encountered an error: ${error.message || error}`);
	}
}
