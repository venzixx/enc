import { type StringSelectMenuInteraction, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketMulti extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_multi", // Matches ticket_multi_${panelId}
		});
	}

	public async run(interaction: StringSelectMenuInteraction): Promise<any> {
		if (!interaction.guild) return;
		const parts = interaction.customId.split('_');
		const panelId = parts[2];
        const optionId = interaction.values[0];

        // Fetch panel config
        const config = await (this.client.prisma as any).ticketConfig.findUnique({
            where: { guildId_panelId: { guildId: interaction.guild.id, panelId: panelId } },
            include: { options: true }
        });

        if (!config || !config.isMulti) {
            return await interaction.reply({ content: `${this.client.emoji.cross} This ticket panel is no longer configured.`, ephemeral: true });
        }

        const optionInfo = config.options.find((o: any) => o.optionId === optionId);
        if (!optionInfo) {
            return await interaction.reply({ content: `${this.client.emoji.cross} This ticket category is no longer valid.`, ephemeral: true });
        }

		const channelName = `${optionId}-${interaction.user.username}`;
		
		const ticketChannel = await interaction.guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			parent: optionInfo.categoryId,
			permissionOverwrites: [
				{
					id: interaction.guild.id,
					deny: [PermissionFlagsBits.ViewChannel],
				},
				{
					id: interaction.user.id,
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
				},
				{
					id: optionInfo.supportRoleId,
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
				}
			]
		});

        // Save Ticket to DB
        const ticket = await (this.client.prisma as any).ticket.create({
            data: {
                guildId: interaction.guild.id,
                channelId: ticketChannel.id,
                userId: interaction.user.id,
                status: 'OPEN'
            }
        });

		const ticketLayout = V2Helper.createLayout({
			title: ' Ticket Dashboard',
			description: config.welcomeMessage ? config.welcomeMessage.replace('{user}', interaction.user.toString()) : `Hello ${interaction.user.toString()}, welcome to your support ticket. Our staff will be with you shortly.`,
            fields: [
                { name: 'Creator', value: interaction.user.toString(), inline: true },
                { name: 'Category', value: optionInfo.label, inline: true },
                { name: 'Claimed By', value: 'Unclaimed', inline: true }
            ],
			color: this.client.color.main,
            buttons: [
                new ButtonBuilder()
                    .setCustomId(`ticket_claim_${ticket.id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`ticket_close`)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`ticket_rename`)
                    .setLabel('Rename')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`ticket_add`)
                    .setLabel('Add User')
                    .setStyle(ButtonStyle.Secondary)
            ]
        });

		await ticketChannel.send({ 
            content: `${interaction.user} | <@&${optionInfo.supportRoleId}>`, 
            ...(ticketLayout as any)
        });

		await interaction.reply({ 
            ...V2Helper.createLayout({
                title: `${this.client.emoji.success} Ticket Opened`,
                description: `Your ticket has been opened in ${ticketChannel}!`,
                isAlert: true,
                color: this.client.color.main,
                ephemeral: true
            }) as any
        });
	}
}
