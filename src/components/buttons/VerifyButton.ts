import { type ButtonInteraction, type GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { CaptchaManager } from "../../utils/CaptchaManager";
import { VerificationFilterEngine } from "../../utils/VerificationFilterEngine";
import crypto from "crypto";

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

		// Evaluate Gatekeeper Security Filters
		const filterResult = await VerificationFilterEngine.evaluate(this.client, member, guildData);
		if (!filterResult.passed) {
			if (filterResult.actionTaken === "BAN" || filterResult.actionTaken === "KICK") {
				return await interaction.reply({
					content: `${this.client.emoji.cross} Your account was rejected by the server verification filter:\n\n${filterResult.reason}`,
					ephemeral: true
				});
			}
			return await interaction.reply({
				content: `${this.client.emoji.cross} **Verification Blocked**: Your account does not meet the server security requirements:\n\n${filterResult.reason}`,
				ephemeral: true
			});
		}

		const verifyType = guildData.verificationType || "NORMAL";

		// 1. NORMAL (1-Click Instant)
		if (verifyType === "NORMAL") {
			try {
				await member.roles.add(role.id, "Normal Verification passed");

				if (guildData.unverifiedRoleId && member.roles.cache.has(guildData.unverifiedRoleId)) {
					await member.roles.remove(guildData.unverifiedRoleId, "Normal Verification passed").catch(() => {});
				}
				if (guildData.verificationSilentRoleId && member.roles.cache.has(guildData.verificationSilentRoleId)) {
					await member.roles.remove(guildData.verificationSilentRoleId, "Normal Verification passed").catch(() => {});
				}

				if (guildData.verificationLogChannelId) {
					const logChannel = interaction.guild.channels.cache.get(guildData.verificationLogChannelId);
					if (logChannel && logChannel.isTextBased()) {
						const logEmbed = new EmbedBuilder()
							.setColor(0x10b981)
							.setTitle("🛡️ Member Verified")
							.setDescription(`**Member:** <@${member.id}> (${member.user.tag})\n**Method:** Normal (1-Click Gate)\n**Role Given:** <@&${role.id}>`)
							.setTimestamp();
						await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
					}
				}

				return await interaction.reply({
					content: `${this.client.emoji.success} You have been verified successfully! Welcome to **${interaction.guild.name}**.`,
					ephemeral: true
				});
			} catch (e: any) {
				return await interaction.reply({
					content: `${this.client.emoji.cross} Failed to assign verification role: ${e.message}`,
					ephemeral: true
				});
			}
		}

		// 2. CAPTCHA Mode
		if (verifyType === "CAPTCHA") {
			try {
				const attachment = await CaptchaManager.createCaptcha(interaction.user.id);
				
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('verify_captcha_modal')
						.setLabel('Submit Captcha')
						.setStyle(ButtonStyle.Primary)
				);

				return await interaction.reply({ 
					content: `Please solve the captcha below to verify. Click **Submit Captcha** to enter the text.`, 
					files: [attachment],
					components: [row],
					ephemeral: true 
				});
			} catch (e: any) {
				return await interaction.reply({ content: `${this.client.emoji.cross} Failed to generate captcha: ${e.message}`, ephemeral: true });
			}
		}

		// 3. WEBSITE Mode (Hardware Fingerprint + IP + Alt Detection)
		if (verifyType === "WEBSITE") {
			try {
				const token = crypto.randomBytes(24).toString("hex");
				const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

				await this.client.prisma.verificationSession.create({
					data: {
						token,
						guildId: interaction.guildId,
						userId: interaction.user.id,
						userTag: interaction.user.tag,
						expiresAt
					}
				});

				const verifyUrl = `https://bot.encl.asia/verify/${token}`;

				const embed = new EmbedBuilder()
					.setColor(0x38bdf8)
					.setTitle("🛡️ Complete Web Security Verification")
					.setDescription(
						`To access **${interaction.guild.name}**, please complete our web verification challenge.\n\n` +
						`🔐 **Why?** Protects against raid bots, alt evasion, and malicious automated accounts.\n` +
						`⏱️ **Expires in:** 15 minutes\n\n` +
						`Click the button below to verify your device securely.`
					)
					.setFooter({ text: "Encl Security Engine • Device Fingerprint & Alt Detection" });

				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("Open Verification Portal 🛡️")
						.setStyle(ButtonStyle.Link)
						.setURL(verifyUrl)
				);

				return await interaction.reply({
					embeds: [embed],
					components: [row],
					ephemeral: true
				});
			} catch (e: any) {
				return await interaction.reply({
					content: `${this.client.emoji.cross} Failed to generate verification portal session: ${e.message}`,
					ephemeral: true
				});
			}
		}
	}
}
