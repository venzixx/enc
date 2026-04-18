import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';
import { Component } from '../../structures';
import { ExtendedClient } from '../../client';

export default class ConfessCreate extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'confess_create'
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		const modal = new ModalBuilder()
			.setCustomId('confession_modal')
			.setTitle(' Anonymous Confession');

		const confessionInput = new TextInputBuilder()
			.setCustomId('confession_text')
			.setLabel('Your Secret')
			.setPlaceholder('Enter your anonymous confession here...')
			.setStyle(TextInputStyle.Paragraph)
			.setMinLength(10)
			.setMaxLength(2000)
			.setRequired(true);

		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(confessionInput);
		modal.addComponents(row);

		await interaction.showModal(modal);
	}
}
