import { type ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class TicketRename extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_rename",
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
            return await interaction.reply({ content: `${this.client.emoji.cross} Only staff can rename tickets.`, ephemeral: true });
        }

		const modal = new ModalBuilder()
			.setCustomId('ticket_rename_modal')
			.setTitle('Rename Ticket');

		const nameInput = new TextInputBuilder()
			.setCustomId('new_name')
			.setLabel('New Ticket Name')
			.setPlaceholder('support-john-doe')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
            .setMaxLength(100);

		const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
		modal.addComponents(firstActionRow);

		await interaction.showModal(modal);
	}
}
