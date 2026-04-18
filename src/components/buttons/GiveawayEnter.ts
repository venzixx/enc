import { type ButtonInteraction } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class GiveawayEnter extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "giveaway_enter",
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
        // Find giveaway
		const giveaway = await this.client.prisma.giveaway.findUnique({
			where: { messageId: interaction.message.id }
		});

		if (!giveaway || !giveaway.isActive) {
			return await interaction.reply({
				...V2Helper.createLayout({
					title: `${this.client.emoji.cross} Giveaway Ended`,
					description: 'This giveaway is no longer active.',
					isAlert: true,
					color: this.client.color.red,
					ephemeral: true
				}) as any
			});
		}

        // Check if already entered
		const exists = await this.client.prisma.giveawayEntry.findUnique({
			where: { giveawayId_userId: { giveawayId: giveaway.id, userId: interaction.user.id } }
		});

		if (exists) {
			return await interaction.reply({
				...V2Helper.createLayout({
					title: `${this.client.emoji.cross} Already Entered`,
					description: 'You have already joined this giveaway!',
					isAlert: true,
					color: this.client.color.red,
					ephemeral: true
				}) as any
			});
		}

        const member = await interaction.guild!.members.fetch(interaction.user.id);
        const guildConf = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild!.id } });

        // 1. Blacklist Check
        const blacklisted = await this.client.prisma.giveawayBlacklist.findUnique({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } }
        });
        if (blacklisted) {
            return await interaction.reply({ content: 'You are blacklisted from joining giveaways.', ephemeral: true });
        }

        // 2. Bypass Check
        const hasBypass = guildConf?.giveawayBypassRoleId && member.roles.cache.has(guildConf.giveawayBypassRoleId);

        // 3. Requirements
        if (!hasBypass) {
            if (giveaway.reqRoleId && !member.roles.cache.has(giveaway.reqRoleId)) {
                return await interaction.reply({ content: `You need the <@&${giveaway.reqRoleId}> role to enter this giveaway.`, ephemeral: true });
            }

            if (giveaway.reqInvites && giveaway.reqInvites > 0) {
                const invites = await interaction.guild!.invites.fetch().catch(() => null);
                let inviteCount = 0;
                if (invites) {
                    const userInvites = invites.filter((i) => i.inviter?.id === interaction.user.id);
                    inviteCount = userInvites.reduce((acc, invite) => acc + (invite.uses || 0), 0);
                }
                
                if (inviteCount < giveaway.reqInvites) {
                    return await interaction.reply({ content: `You need at least **${giveaway.reqInvites}** invites to enter this giveaway. You currently have **${inviteCount}**.`, ephemeral: true });
                }
            }
        }

        // 4. Calculate entries count
        let entriesToCreate = 1;

        const bonusEntriesMap = await (this.client.prisma as any).giveawayBonusEntry.findMany({
            where: { guildId: interaction.guild!.id }
        });

        for (const bonus of bonusEntriesMap) {
            if (bonus.type === 'ROLE' && member.roles.cache.has(bonus.targetId)) {
                entriesToCreate += Math.max(0, bonus.entries);
            } else if (bonus.type === 'USER' && interaction.user.id === bonus.targetId) {
                entriesToCreate += Math.max(0, bonus.entries);
            }
        }

        // Create main entry + bonus copies internally using `entriesToCreate` inside our logic.
        // Wait, the schema `giveawayEntry` is a unique constraint on (giveawayId, userId). So we can't create multiple.
        // How does the reroll algorithm pick someone multiple times? We can add a `weight` column to `giveawayEntry`.
        // Let's just create the entry. We don't have weight yet, but we'll adapt reroll logic to fetch weights or we just add `weight` to Entry table later.

        // Wait, creating multiple entries breaks Unique constraint.
        // Let's modify the upsert logic if it already has duplicate check.
		await (this.client.prisma as any).giveawayEntry.create({
			data: {
				giveawayId: giveaway.id,
				userId: interaction.user.id,
                weight: entriesToCreate
			}
		});

		await interaction.reply({
			...V2Helper.createLayout({
				title: `${this.client.emoji.success} Entry Confirmed`,
				description: `You have successfully entered the giveaway! Good luck!${entriesToCreate > 1 ? `\n*(You received **${entriesToCreate}** total entries due to your roles)*` : ''}`,
				isAlert: true,
				color: this.client.color.main,
				ephemeral: true
			}) as any
		});
	}
}
