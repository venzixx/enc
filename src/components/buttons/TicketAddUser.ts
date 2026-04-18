import { type ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class TicketAddUser extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_add",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

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
            return await interaction.reply({ content: `${this.client.emoji.cross} Only staff can add users to tickets.`, ephemeral: true });
        }

		const modal = new ModalBuilder()
			.setCustomId('ticket_add_modal')
			.setTitle('Add User to Ticket');

		const userInput = new TextInputBuilder()
			.setCustomId('user_id')
			.setLabel('User ID')
			.setPlaceholder('Enter the user ID to add')
			.setStyle(TextInputStyle.Short)
			.setRequired(true);

		const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(userInput);
		modal.addComponents(firstActionRow);

		await interaction.showModal(modal);
	}
}
