import { type ModalSubmitInteraction, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

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

            await interaction.reply({
                ...V2Helper.createLayout({
                    title: 'User Added to Ticket',
                    description: `${targetUser} has been added to the ticket by ${interaction.user}.`,
                    borderless: true,
                    color: null
                }) as any
            });
        } catch (error) {
            await interaction.reply({ 
                ...V2Helper.createLayout({
                    title: `${this.client.emoji.cross || '❌'} Error`,
                    description: 'Invalid User ID or user not found in this server.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    ephemeral: true
                }) as any 
            });
        }
	}
}
