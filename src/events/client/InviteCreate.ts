import { Events, Collection, type Invite } from "discord.js";
import { Event } from "../../structures";
import { LavamusicEventType } from "../../types/events";
import { ExtendedClient } from "../../client";

export default class InviteCreate extends Event {
	constructor(client: ExtendedClient, file: string) {
		super(client, file, {
			type: LavamusicEventType.Client,
			name: Events.InviteCreate,
		});
	}

	public async run(invite: Invite): Promise<void> {
		const guild = invite.guild;
		if (!guild) return;

		const inviteCache = this.client.invites.get(guild.id) || new Collection<string, number>();
		inviteCache.set(invite.code, invite.uses || 0);
		this.client.invites.set(guild.id, inviteCache as any);
	}
}
