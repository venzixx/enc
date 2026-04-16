import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class ShuffleButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "shuffle",
			aliases: ["SHUFFLE_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		await player.queue.shuffle();
		await interaction.deferUpdate();
		await updatePlayerMessage(
			this.client,
			interaction,
			player,
			t(I18N.player.trackStart.shuffled_by, { user: interaction.user.tag }),
		);
	}
}
