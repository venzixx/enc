import { 
    ModalSubmitInteraction, 
    EmbedBuilder, 
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Component } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class ConfessionModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'confession_modal'
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		const confession = interaction.fields.getTextInputValue('confession_text');

		const guildData = await this.client.prisma.guild.findUnique({
			where: { id: interaction.guildId! }
		});

		if (!guildData?.confessionChannel) {
			return await interaction.reply({ content: `${this.client.emoji.cross} Confessions are not set up in this server.`, ephemeral: true });
		}

		const channel = interaction.guild!.channels.cache.get(guildData.confessionChannel) as TextChannel;
		if (!channel) {
			return await interaction.reply({ content: `${this.client.emoji.cross} The confession channel no longer exists.`, ephemeral: true });
		}

		try {
			let confessionNumber = 0;
			let success = false;
			let retries = 0;

			while (!success && retries < 3) {
				try {
					// Get the next confession number for this guild
					const lastConfession = await this.client.prisma.confession.findFirst({
						where: { guildId: interaction.guildId! },
						orderBy: { number: 'desc' }
					});
					confessionNumber = (lastConfession?.number || 0) + 1;

					// Save to database (author info stored privately)
					await this.client.prisma.confession.create({
						data: {
							guildId: interaction.guildId!,
							number: confessionNumber,
							userId: interaction.user.id,
							userTag: interaction.user.tag,
							content: confession
						}
					});
					success = true;
				} catch (error: any) {
					if (error.code === 'P2002') { // Unique constraint failed
						retries++;
						continue;
					}
					throw error; // Rethrow other errors
				}
			}

			if (!success) {
				return await interaction.reply({ content: `${this.client.emoji.cross} Failed to send confession after multiple attempts due to high traffic. Please try again!`, ephemeral: true });
			}

			// Build the anonymous V2 layout
			const layout = V2Helper.createLayout({
				title: ` Anonymous Confession #${confessionNumber}`,
				description: confession,
				color: this.client.color.main,
				footer: 'Click the button below to send your own confession!',
				buttons: [
					new ButtonBuilder()
						.setCustomId('confess_create')
						.setLabel('Write a Confession')
						.setEmoji('1494693086843109527')
						.setStyle(ButtonStyle.Secondary)
				]
			});

			await channel.send(layout as any);
			
			await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.success} Confession Sent`,
                    description: `Your confession **#${confessionNumber}** has been sent anonymously!`,
                    isAlert: true,
                    color: this.client.color.main,
                    ephemeral: true
                }) as any
            });
		} catch (error) {
			console.error('Confession error:', error);
			await interaction.reply({ content: `${this.client.emoji.cross} I failed to send your confession.`, ephemeral: true });
		}
	}
}
