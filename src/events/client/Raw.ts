import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class Raw extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: "raw",
		});
	}

	public async run(data: any): Promise<void> {
		this.client.lavalink.sendRawData(data);
	}
}
