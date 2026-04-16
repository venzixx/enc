import { type ButtonInteraction, MessageFlags } from "discord.js";
import { Component } from "../../structures";
import { I18N, t } from "../../structures/I18n";
import { handlePlayerInteraction, updatePlayerMessage } from "../../utils/PlayerUIUtils";
import { ExtendedClient } from "../../client";

export default class SkipButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "skip",
			aliases: ["SKIP_BUT"],
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const player = await handlePlayerInteraction(this.client, interaction);
		if (!player) return;

		if (player.queue.tracks.length > 0) {
			await interaction.deferUpdate();
			await player.skip();
			await updatePlayerMessage(
				this.client,
				interaction,
				player,
				t(I18N.player.trackStart.skipped_by, { user: interaction.user.tag }),
			);
		} else {
            const locale = await this.client.db.getLanguage(interaction.guildId!);
			await interaction.reply({
				content: t(I18N.player.trackStart.no_more_songs_in_queue, { lng: locale }),
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}
