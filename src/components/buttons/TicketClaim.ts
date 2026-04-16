import { type ButtonInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class TicketClaim extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_claim", // Matches ticket_claim_${ticketId}
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;
		const parts = interaction.customId.split('_');
		const ticketId = parseInt(parts[2]);

        // Fetch ticket from DB
        const ticket = await (this.client.prisma as any).ticket.findUnique({
            where: { id: ticketId }
        });

        if (!ticket) {
            return await interaction.reply({ content: '❌ Ticket data not found in database.', ephemeral: true });
        }

        // Check if already claimed
        if (ticket.claimantId) {
            return await interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.claimantId}>.`, ephemeral: true });
        }

        // Check staff role
        const config = await (this.client.prisma as any).ticketConfig.findFirst({
            where: { 
                guildId: interaction.guild.id,
                categoryId: (interaction.channel as any).parentId
            }
        });

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = member.roles.cache.has(config?.supportRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return await interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
        }

        // Update DB
        await (this.client.prisma as any).ticket.update({
            where: { id: ticketId },
            data: { claimantId: interaction.user.id }
        });

        // Update the dashboard embed
        const message = interaction.message;
        const embed = EmbedBuilder.from(message.embeds[0]);
        
        // Find "Claimed By" field and update it
        const fields = [...embed.data.fields!];
        const claimedByIndex = fields.findIndex(f => f.name === 'Claimed By');
        if (claimedByIndex !== -1) {
            fields[claimedByIndex].value = interaction.user.toString();
        }
        embed.setFields(fields);

        // Update interaction components (disable claim button)
        const row = interaction.message.components[0].toJSON() as any;
        row.components[0].disabled = true;
        row.components[0].label = 'Claimed';

        await interaction.update({ embeds: [embed], components: [row] });

		await interaction.followUp({ content: `✅ Ticket claimed by ${interaction.user}!`, ephemeral: false });
	}
}
