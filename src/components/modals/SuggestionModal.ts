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

export default class SuggestionModal extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'suggestion_modal'
        });
    }

    public async run(interaction: ModalSubmitInteraction): Promise<any> {
        const content = interaction.fields.getTextInputValue('suggestion_content');
        const isAnonymous = interaction.customId.split('_').pop() === 'true';

        const guildData = await this.client.prisma.guild.findUnique({
            where: { id: interaction.guildId! }
        });

        if (!guildData?.suggestionChannelId) {
            return await interaction.reply({ content: '❌ Suggestion channel is not configured.', ephemeral: true });
        }

        const channel = interaction.guild!.channels.cache.get(guildData.suggestionChannelId) as TextChannel;
        if (!channel) {
            return await interaction.reply({ content: '❌ The suggestion channel no longer exists.', ephemeral: true });
        }

        try {
            // Initial Embed
            const embed = new EmbedBuilder()
                .setTitle('💡 New Suggestion')
                .setDescription(content)
                .addFields(
                    { name: '📊 Statistics', value: '🧪 Upvotes: `0` | ⛔ Downvotes: `0`' }
                )
                .setColor(this.client.color.main)
                .setFooter({ text: 'Use the buttons below to vote!' })
                .setTimestamp();

            if (!isAnonymous) {
                embed.setAuthor({ 
                    name: interaction.user.tag, 
                    iconURL: interaction.user.displayAvatarURL() 
                });
            } else {
                embed.setAuthor({ name: 'Anonymous User' });
            }

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('suggest_up')
                    .setLabel('Upvote')
                    .setEmoji('🧪')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('suggest_down')
                    .setLabel('Downvote')
                    .setEmoji('⛔')
                    .setStyle(ButtonStyle.Danger)
            );

            const msg = await channel.send({ embeds: [embed], components: [buttons] });

            // Save to database
            await this.client.prisma.suggestion.create({
                data: {
                    guildId: interaction.guildId!,
                    messageId: msg.id,
                    authorId: interaction.user.id,
                    content: content,
                    isAnonymous: isAnonymous
                }
            });

            await interaction.reply({ 
                content: '✅ Your suggestion has been submitted successfully!', 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Suggestion Error:', error);
            await interaction.reply({ content: '❌ I failed to post your suggestion.', ephemeral: true });
        }
    }
}
