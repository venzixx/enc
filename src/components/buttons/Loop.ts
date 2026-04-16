import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class LoopButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "loop",
			aliases: ["LOOP_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		const repeatMode = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
		await player.setRepeatMode(repeatMode);
		
		await interaction.deferUpdate();
		await updatePlayerMessage(
			this.client,
			interaction,
			player,
			t(I18N.player.trackStart.loop_all_by, { 
                user: interaction.user.tag,
                mode: repeatMode 
            }),
		);
	}
}
