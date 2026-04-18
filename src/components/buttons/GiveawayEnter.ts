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

		const exists = await this.client.prisma.giveawayEntry.findUnique({
			where: {
				giveawayId_userId: {
					giveawayId: giveaway.id,
					userId: interaction.user.id
				}
			}
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

		await this.client.prisma.giveawayEntry.create({
			data: {
				giveawayId: giveaway.id,
				userId: interaction.user.id
			}
		});

		await interaction.reply({
			...V2Helper.createLayout({
				title: `${this.client.emoji.success} Entry Confirmed`,
				description: 'You have successfully entered the giveaway! Good luck! ',
				isAlert: true,
				color: this.client.color.main,
				ephemeral: true
			}) as any
		});
	}
}
