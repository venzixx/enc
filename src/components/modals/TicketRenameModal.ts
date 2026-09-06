import { type ModalSubmitInteraction } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketRenameModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_rename_modal",
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		if (!interaction.guild || !interaction.channel) return;

		const newName = interaction.fields.getTextInputValue('new_name');
        
        const oldName = (interaction.channel as any).name;
        await (interaction.channel as any).setName(newName);

        await interaction.reply({
            ...V2Helper.createLayout({
                title: 'Ticket Renamed',
                description: `${this.client.emoji.edit || '✏️'} Ticket renamed from \`${oldName}\` to \`${newName}\` by ${interaction.user}`,
                borderless: true,
                color: null
            }) as any
        });
	}
}
