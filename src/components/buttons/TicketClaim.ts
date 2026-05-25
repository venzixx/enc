import { type ButtonInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

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
            return await interaction.reply({ content: `${this.client.emoji.cross} Ticket data not found in database.`, ephemeral: true });
        }

        // Check if already claimed
        if (ticket.claimantId) {
            return await interaction.reply({ content: `${this.client.emoji.cross} This ticket is already claimed by <@${ticket.claimantId}>.`, ephemeral: true });
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
            return await interaction.reply({ content: `${this.client.emoji.cross} Only staff can claim tickets.`, ephemeral: true });
        }

        // Update DB
        await (this.client.prisma as any).ticket.update({
            where: { id: ticketId },
            data: { claimantId: interaction.user.id }
        });

        // Instead of trying to edit the V2 message (which is complex), 
        // just acknowledge and send a follow-up
        await interaction.reply({ content: `${this.client.emoji.success} Ticket claimed by ${interaction.user}!` });
	}
}
