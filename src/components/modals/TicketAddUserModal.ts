import { type ModalSubmitInteraction, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class TicketAddUserModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_add_modal",
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

		const userId = interaction.fields.getTextInputValue('user_id');
        
        try {
            const targetUser = await interaction.guild.members.fetch(userId);
            
            await (interaction.channel as any).permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
                AttachFiles: true
            });

            const embed = new EmbedBuilder()
                .setColor(this.client.color.main)
                .setDescription(`➕ ${targetUser} has been added to the ticket by ${interaction.user}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: '❌ Invalid User ID or user not found in this server.', ephemeral: true });
        }
	}
}
