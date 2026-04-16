import { Events, type Invite } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class InviteDelete extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: Events.InviteDelete,
		});
	}

	public async run(invite: Invite): Promise<void> {
		const guild = invite.guild;
		if (!guild) return;

		const inviteCache = this.client.invites.get(guild.id);
		if (inviteCache) {
			inviteCache.delete(invite.code);
		}
	}
}
