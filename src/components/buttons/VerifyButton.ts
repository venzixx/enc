import { type ButtonInteraction, type GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { CaptchaManager } from "../../utils/CaptchaManager";

export default class VerifyButton extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "verify_button",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guildId || !interaction.guild) return;

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
		if (member.roles.cache.has(role.id)) {
			return await interaction.reply({ content: `${this.client.emoji.info} You are already verified!`, ephemeral: true });
		}

		try {
            const attachment = await CaptchaManager.createCaptcha(interaction.user.id);
            
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_captcha_modal')
                    .setLabel('Submit Captcha')
                    .setStyle(ButtonStyle.Primary)
            );

			await interaction.reply({ 
                content: `Please solve the captcha below to verify. Click **Submit Captcha** to enter the text.`, 
                files: [attachment],
                components: [row],
                ephemeral: true 
            });
		} catch (e: any) {
			await interaction.reply({ content: `${this.client.emoji.cross} Failed to generate captcha: ${e.message}`, ephemeral: true });
		}
	}
}
