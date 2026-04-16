import { type ButtonInteraction, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { Component } from "../../structures";
import { ExtendedClient } from "../../client";
import { V2Helper } from "../../utils/V2Helper";

export default class TicketOpen extends Component {
	constructor(client: ExtendedClient) {
		super(client, {
			name: "ticket_open", // Matches ticket_open_${panelId}
		});
	}

	public async run(interaction: ButtonInteraction): Promise<any> {
		if (!interaction.guild) return;
		const parts = interaction.customId.split('_');
		const panelId = parts[2];

        // Fetch config from DB
        const config = await (this.client.prisma as any).ticketConfig.findUnique({
            where: {
                guildId_panelId: {
                    guildId: interaction.guild.id,
                    panelId: panelId
                }
            }
        });

        if (!config) {
            return await interaction.reply({ content: '❌ This ticket panel is no longer configured.', ephemeral: true });
        }

		const channelName = `${config.panelId}-${interaction.user.username}`;
		
		const ticketChannel = await interaction.guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			parent: config.categoryId,
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
					id: config.supportRoleId,
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
			title: '🎫 Ticket Dashboard',
			description: config.welcomeMessage.replace('{user}', interaction.user.toString()),
            fields: [
                { name: 'Creator', value: interaction.user.toString(), inline: true },
                { name: 'Panel', value: config.name, inline: true },
                { name: 'Claimed By', value: 'Unclaimed', inline: true }
            ],
			color: this.client.color.main,
            buttons: [
                new ButtonBuilder()
                    .setCustomId(`ticket_claim_${ticket.id}`)
                    .setLabel('Claim')
                    .setEmoji('🙋‍♂️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`ticket_close`)
                    .setLabel('Close')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`ticket_rename`)
                    .setLabel('Rename')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`ticket_add`)
                    .setLabel('Add User')
                    .setEmoji('➕')
                    .setStyle(ButtonStyle.Secondary)
            ]
		});

		await ticketChannel.send({ 
            content: `${interaction.user} | <@&${config.supportRoleId}>`, 
            ...(ticketLayout as any)
        });

		await interaction.reply({ 
            ...V2Helper.createLayout({
                title: '✅ Ticket Opened',
                description: `Your ticket has been opened in ${ticketChannel}!`,
                isAlert: true,
                color: this.client.color.main,
                ephemeral: true
            }) as any
        });
	}
}
