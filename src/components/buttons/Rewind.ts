import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class RewindButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "rewind",
			aliases: ["REWIND_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		await player.seek(player.position - 10000);
		await interaction.deferUpdate();
		await updatePlayerMessage(
			this.client,
			interaction,
			player,
			t(I18N.player.trackStart.rewind_by, { user: interaction.user.tag }),
		);
	}
}
