import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { GiveawayManager } from "../../utils/GiveawayManager";

export default class GiveawayEnter extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "giveaway_enter",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
        // 1. Find giveaway by message ID
		const giveaway = await this.client.prisma.giveaway.findUnique({
			where: { messageId: interaction.message.id },
            include: { entries: true }
		});

		if (!giveaway || !giveaway.isActive) {
            const endedEmbed = new EmbedBuilder()
                .setTitle('❌ Giveaway Ended')
                .setDescription('This giveaway is no longer active.')
                .setColor(this.client.color.red || 0xef4444);

			return await interaction.reply({
				embeds: [endedEmbed],
                ephemeral: true
			});
		}

        // 2. Check Blacklist
        const blacklisted = await this.client.prisma.giveawayBlacklist.findUnique({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } }
        });
        if (blacklisted) {
            const blEmbed = new EmbedBuilder()
                .setTitle('🚫 Blacklisted')
                .setDescription('You are blacklisted from joining giveaways in this server.')
                .setColor(this.client.color.red || 0xef4444);

            return await interaction.reply({ embeds: [blEmbed], ephemeral: true });
        }

        const member = await interaction.guild!.members.fetch(interaction.user.id);
        const guildConf = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild!.id } });

        // 3. Bypass Check
        const hasBypass = guildConf?.giveawayBypassRoleId && member.roles.cache.has(guildConf.giveawayBypassRoleId);

        // 4. Requirements Check (if no bypass)
        if (!hasBypass) {
            if (giveaway.reqRoleId && !member.roles.cache.has(giveaway.reqRoleId)) {
                const reqRoleEmbed = new EmbedBuilder()
                    .setTitle('🔒 Role Requirement')
                    .setDescription(`You need the <@&${giveaway.reqRoleId}> role to enter this giveaway.`)
                    .setColor(this.client.color.red || 0xef4444);

                return await interaction.reply({ embeds: [reqRoleEmbed], ephemeral: true });
            }

            if (giveaway.reqInvites && giveaway.reqInvites > 0) {
                const invites = await interaction.guild!.invites.fetch().catch(() => null);
                let inviteCount = 0;
                if (invites) {
                    const userInvites = invites.filter((i) => i.inviter?.id === interaction.user.id);
                    inviteCount = userInvites.reduce((acc, invite) => acc + (invite.uses || 0), 0);
                }
                
                if (inviteCount < giveaway.reqInvites) {
                    const reqInvEmbed = new EmbedBuilder()
                        .setTitle('✉️ Invite Requirement')
                        .setDescription(`You need at least **${giveaway.reqInvites}** invites to enter this giveaway. You currently have **${inviteCount}**.`)
                        .setColor(this.client.color.red || 0xef4444);

                    return await interaction.reply({ embeds: [reqInvEmbed], ephemeral: true });
                }
            }
        }

        // 5. Check if user already entered -> Toggle Leave / Join
		const existingEntry = await this.client.prisma.giveawayEntry.findUnique({
			where: { giveawayId_userId: { giveawayId: giveaway.id, userId: interaction.user.id } }
		});

		if (existingEntry) {
            // Remove entry (Leave giveaway)
            await this.client.prisma.giveawayEntry.delete({
                where: { id: existingEntry.id }
            });

            const newCount = Math.max(0, giveaway.entries.length - 1);
            
            // Update button label on message
            await interaction.message.edit({
                components: [GiveawayManager.buildButtons(newCount, false)]
            }).catch(() => null);

            const leaveEmbed = new EmbedBuilder()
                .setTitle('👋 Entry Removed')
                .setDescription(`You have left the giveaway for **${giveaway.prize}**. You can click Enter again anytime before it ends.`)
                .setColor(this.client.color.red || 0xef4444);

			return await interaction.reply({
				embeds: [leaveEmbed],
                ephemeral: true
			});
		}

        // 6. Create Entry
		await this.client.prisma.giveawayEntry.create({
			data: {
				giveawayId: giveaway.id,
				userId: interaction.user.id
			}
		});

        // 7. Check for bonus entries
        const bonusEntriesMap = await this.client.prisma.giveawayBonusEntry.findMany({
            where: { guildId: interaction.guild!.id }
        });

        let bonusCount = 0;
        for (const bonus of bonusEntriesMap) {
            if (bonus.type === 'ROLE' && member.roles.cache.has(bonus.targetId)) {
                bonusCount += Math.max(0, bonus.entries);
            } else if (bonus.type === 'USER' && interaction.user.id === bonus.targetId) {
                bonusCount += Math.max(0, bonus.entries);
            }
        }

        const totalEntries = giveaway.entries.length + 1;

        // Update button label on message
        await interaction.message.edit({
            components: [GiveawayManager.buildButtons(totalEntries, false)]
        }).catch(() => null);

        const joinEmbed = new EmbedBuilder()
            .setTitle('🎉 Entry Confirmed!')
            .setDescription(
                `You have successfully entered the giveaway for **${giveaway.prize}**! Good luck!\n\n` +
                (bonusCount > 0 ? `✨ *You have **+${bonusCount} bonus entries** (${bonusCount + 1}x total chance).*` : '')
            )
            .setColor(this.client.color.main || 0x22c55e);

		await interaction.reply({
			embeds: [joinEmbed],
            ephemeral: true
		});
	}
}
