import { 
    ButtonInteraction, 
    EmbedBuilder, 
} from 'discord.js';
import { Component } from '../../structures';
import { ExtendedClient } from '../../client';

export default class SuggestionVote extends Component {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'suggest' // Matches suggest_up and suggest_down
        });
    }

    public async run(interaction: ButtonInteraction): Promise<any> {
        const type = interaction.customId.split('_').pop()?.toUpperCase(); // "UP" or "DOWN"
        if (!type) return;

        const suggestion = await this.client.prisma.suggestion.findUnique({
            where: { messageId: interaction.message.id },
            include: { votes: true }
        });

        if (!suggestion) {
            return await interaction.reply({ content: `${this.client.emoji.cross} Suggestion data not found in database.`, ephemeral: true });
        }

        const existingVote = suggestion.votes.find(v => v.userId === interaction.user.id);

        // Logic check: Same vote type?
        if (existingVote && existingVote.type === type) {
            const voteName = type === 'UP' ? 'upvoted' : 'downvoted';
            const oppositeName = type === 'UP' ? 'Downvote' : 'Upvote';
            
            return await interaction.reply({ 
                content: `${this.client.emoji.info} You have already ${voteName}. To change your vote, click the **${oppositeName}** button.`, 
                ephemeral: true 
            });
        }

        // Upsert the vote
        if (existingVote) {
            await this.client.prisma.suggestionVote.update({
                where: { id: existingVote.id },
                data: { type }
            });
        } else {
            await this.client.prisma.suggestionVote.create({
                data: {
                    suggestionId: suggestion.id,
                    userId: interaction.user.id,
                    type: type
                }
            });
        }

        // Get updated counts
        const allVotes = await this.client.prisma.suggestionVote.findMany({
            where: { suggestionId: suggestion.id }
        });

        const upvotes = allVotes.filter(v => v.type === 'UP').length;
        const downvotes = allVotes.filter(v => v.type === 'DOWN').length;

        // Update the Embed
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setFields([
                { name: ' Statistics', value: ` Upvotes: \`${upvotes}\` |  Downvotes: \`${downvotes}\`` }
            ]);

        await interaction.update({ embeds: [newEmbed] });
    }
}
