import { type ModalSubmitInteraction, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

export default class VoiceRenameModal extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "vc_rename_modal",
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		if (!interaction.guild || !interaction.member) return;

        const member = interaction.member as any;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: `${this.client.emoji.cross} You must be in your voice channel to rename it.`, ephemeral: true });
        }

		const newName = interaction.fields.getTextInputValue('new_name');
        
        try {
            const oldName = voiceChannel.name;
            await (voiceChannel as any).setName(newName);

            await interaction.reply({ content: `${this.client.emoji.success} Voice channel renamed from \`${oldName}\` to \`${newName}\`.`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `${this.client.emoji.cross} Failed to rename channel. Make sure I have permissions and you aren\'t renaming too fast.`, ephemeral: true });
        }
	}
}
