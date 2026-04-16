import { type ButtonInteraction, type GuildMember } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";

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
			return await interaction.reply({ content: '❌ Verification system is not configured correctly.', ephemeral: true });
		}

		const role = interaction.guild.roles.cache.get(guildData.verificationRoleId);
		if (!role) {
			return await interaction.reply({ content: '❌ Verification role not found.', ephemeral: true });
		}

		const member = interaction.member as GuildMember;
		if (member.roles.cache.has(role.id)) {
			return await interaction.reply({ content: 'ℹ️ You are already verified!', ephemeral: true });
		}

		try {
			await member.roles.add(role);
			await interaction.reply({ content: '✅ You have been verified and granted access!', ephemeral: true });
		} catch (e: any) {
			await interaction.reply({ content: `❌ Failed to grant role: ${e.message}`, ephemeral: true });
		}
	}
}
