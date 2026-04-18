import { ModalSubmitInteraction } from 'discord.js';
import { Component } from '../../structures';
import { ExtendedClient } from '../../client';

export default class AICharacterModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ai_character_modal'
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		const customPrompt = interaction.fields.getTextInputValue('ai_custom_prompt');

		try {
			// Save Custom Personality to Database
			await this.client.prisma.guild.update({
				where: { id: interaction.guildId! },
				data: { 
                    aiPersonality: 'CUSTOM',
                    aiCustomPrompt: customPrompt
                }
			});

			await interaction.reply({ 
                content: `${this.client.emoji.success} **Custom Personality Set!** I will now act as described in your prompt.`,
                ephemeral: true 
            });
		} catch (error) {
			console.error('AI Character Modal error:', error);
			await interaction.reply({ content: `${this.client.emoji.cross} I failed to save your custom personality.`, ephemeral: true });
		}
	}
}
