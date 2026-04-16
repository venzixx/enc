import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class VolumeUpButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "vol_up",
			aliases: ["VOL_UP_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		const volume = Math.min(player.volume + 10, 200);
		await player.setVolume(volume);
		
		await interaction.deferUpdate();
		await updatePlayerMessage(
			this.client,
			interaction,
			player,
			t(I18N.player.trackStart.volume_up_by, { 
                user: interaction.user.tag,
                volume: volume 
            }),
		);
	}
}
