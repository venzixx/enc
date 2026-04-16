import { type ButtonInteraction, MessageFlags } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class PreviousButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "previous",
			aliases: ["PREV_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		if (player.queue.previous.length > 0) {
			await interaction.deferUpdate();
			await player.queue.previous.unshift(player.queue.current!);
            const track = player.queue.previous.pop()!;
            await player.play({ track });
            
			await updatePlayerMessage(
				this.client,
				interaction,
				player,
				t(I18N.player.trackStart.previous_by, { user: interaction.user.tag }),
			);
		} else {
            const locale = await this.client.db.getLanguage(interaction.guildId!);
			await interaction.reply({
				content: t(I18N.player.trackStart.no_previous_song, { lng: locale }),
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}
