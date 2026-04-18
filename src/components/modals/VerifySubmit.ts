import { type ModalSubmitInteraction, type GuildMember } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { CaptchaManager } from "../../utils/CaptchaManager";

export default class VerifySubmit extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "verify_submit",
		});
	}

	public async run(interaction: ModalSubmitInteraction): Promise<any> {
		if (!interaction.guildId || !interaction.guild) return;

		const input = interaction.fields.getTextInputValue("captcha_input");
        const userId = interaction.user.id;

        const isCorrect = CaptchaManager.verify(userId, input);

        if (!isCorrect) {
            return await interaction.reply({
                content: `${this.client.emoji.cross} Incorrect Captcha! Please click **Verify** again to get a new image.`,
                ephemeral: true
            });
        }

		const guildData = await this.client.prisma.guild.findUnique({
			where: { id: interaction.guildId }
		});

		if (!guildData || !guildData.verificationRoleId) {
			return await interaction.reply({ content: `${this.client.emoji.cross} Verification system is not configured correctly.`, ephemeral: true });
		}

		const role = interaction.guild.roles.cache.get(guildData.verificationRoleId);
		if (!role) {
			return await interaction.reply({ content: `${this.client.emoji.cross} Verification role not found.`, ephemeral: true });
		}

		const member = interaction.member as GuildMember;
		try {
			await member.roles.add(role);
			await interaction.reply({ content: `${this.client.emoji.success} **Captcha Solved!** You have been verified and granted access!`, ephemeral: true });
            
            // Delete original ephemeral message to clean up the image (not easily possible with ephemeral interactions, but discord handles cleanup eventually).
		} catch (e: any) {
			await interaction.reply({ content: `${this.client.emoji.cross} Failed to grant role: ${e.message}`, ephemeral: true });
		}
	}
}
