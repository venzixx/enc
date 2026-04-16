import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class StopButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "stop",
			aliases: ["STOP_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		await player.destroy();
		await interaction.deferUpdate();
	}
}
