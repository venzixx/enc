import { type ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

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

        const embed = new EmbedBuilder()
            .setColor(this.client.color.main)
            .setDescription(`📝 Ticket renamed from \`${oldName}\` to \`${newName}\` by ${interaction.user}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
	}
}
