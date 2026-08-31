import { type ButtonInteraction, ButtonBuilder, ButtonStyle } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketClose extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_close",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

        // Fetch ticket from DB
        const ticket = await (this.client.prisma as any).ticket.findUnique({
            where: { channelId: interaction.channel.id }
        });

        if (!ticket) {
            return await interaction.reply({ 
                ...V2Helper.createLayout({
                    description: `${this.client.emoji.cross || '❌'} Ticket data not found. I can only close registered tickets.`,
                    isAlert: true,
                    borderless: true
                }) as any,
                ephemeral: true 
            });
        }

        if (ticket.status === 'CLOSED') {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross || '❌'} This ticket is already in the process of closing.`, 
                ephemeral: true 
            });
        }

        // Send Persistent Borderless V2 Close Confirmation Layout
        const closePayload = V2Helper.createLayout({
            title: '🔒 Ticket Close Confirmation',
            description: `Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be archived, and this channel will be closed.\n\n<@${ticket.userId}> or Support Staff, please confirm below.`,
            isAlert: true,
            color: 0xFFA500,
            borderless: true,
            buttons: [
                new ButtonBuilder()
                    .setCustomId('ticket_confirm_close')
                    .setLabel('Confirm Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_cancel_close')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            ]
        });

        return await interaction.reply(closePayload as any);
	}
}
