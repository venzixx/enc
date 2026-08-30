import { type ModalSubmitInteraction, type GuildMember } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { CaptchaManager } from "../../utils/CaptchaManager";
import { V2Helper } from "../../utils/V2Helper";

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
			await member.roles.add(role.id, "Captcha Verification passed");

			if (guildData.unverifiedRoleId && member.roles.cache.has(guildData.unverifiedRoleId)) {
				await member.roles.remove(guildData.unverifiedRoleId, "Captcha Verification passed").catch(() => {});
			}
			if (guildData.verificationSilentRoleId && member.roles.cache.has(guildData.verificationSilentRoleId)) {
				await member.roles.remove(guildData.verificationSilentRoleId, "Captcha Verification passed").catch(() => {});
			}

			if (guildData.verificationLogChannelId) {
				const logChannel = interaction.guild.channels.cache.get(guildData.verificationLogChannelId);
				if (logChannel && logChannel.isTextBased()) {
					const layout = V2Helper.createLayout({
						title: "🛡️ Member Verified",
						description: `**Member:** <@${member.id}> (${member.user.tag})\n**Status:** Verified\n**Method:** Image Captcha Solved\n**Role Given:** <@&${role.id}>`,
						footer: "Encl Security Engine",
						timestamp: true,
						borderless: true
					});
					await (logChannel as any).send({
						...layout,
						allowedMentions: { parse: [], roles: [], users: [] }
					}).catch(() => {});
				}
			}

			// Record in database AuditLog
			await this.client.prisma.auditLog.create({
				data: {
					guildId: interaction.guildId,
					type: "VERIFICATION",
					event: "CAPTCHA_VERIFY",
					status: "SUCCESS",
					targetId: member.id,
					targetName: member.user.tag,
					details: `Solved Captcha Challenge • Role: ${role.name}`
				}
			}).catch(() => {});

			await interaction.reply({ content: `${this.client.emoji.success} **Captcha Solved!** You have been verified and granted access!`, ephemeral: true });
		} catch (e: any) {
			await interaction.reply({ content: `${this.client.emoji.cross} Failed to grant role: ${e.message}`, ephemeral: true });
		}
	}
}
