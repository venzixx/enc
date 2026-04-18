import { type ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class VerifyCaptchaModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "verify_captcha_modal",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const modal = new ModalBuilder()
			.setCustomId("verify_submit")
			.setTitle("Verification Captcha");

		const input = new TextInputBuilder()
			.setCustomId("captcha_input")
			.setLabel("Enter the text from the image")
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setMinLength(5)
			.setMaxLength(8);

		const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
		modal.addComponents(firstActionRow);

		await interaction.showModal(modal);
	}
}
