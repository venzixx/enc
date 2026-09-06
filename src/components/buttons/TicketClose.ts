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
                    title: `${this.client.emoji.cross || '❌'} Invalid Channel`,
                    description: 'Ticket data not found. I can only close registered tickets.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any
            });
        }

        if (ticket.status === 'CLOSED') {
            return await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.cross || '❌'} Already Closing`,
                    description: 'This ticket is already in the process of closing.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any
            });
        }

        // Send Persistent Borderless V2 Close Confirmation Layout
        const closePayload = V2Helper.createLayout({
            title: '🔒 Ticket Close Confirmation',
            description: `Are you sure you want to close this ticket?\n\n**Note:** An HTML transcript will be archived, and this channel will be closed.\n\n<@${ticket.userId}> or Support Staff, please confirm below.`,
            isAlert: true,
            borderless: true,
            color: null,
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
