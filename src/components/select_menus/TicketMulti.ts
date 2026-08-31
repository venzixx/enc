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
		const selectedOption = interaction.values[0];

        // Fetch config from DB
        let config = await (this.client.prisma as any).ticketConfig.findUnique({
            where: {
                guildId_panelId: {
                    guildId: interaction.guild.id,
                    panelId: panelId
                }
            }
        });

        // Smart Fallback 1: Match by panel message ID
        if (!config && interaction.message) {
            config = await (this.client.prisma as any).ticketConfig.findFirst({
                where: {
                    guildId: interaction.guild.id,
                    messageId: interaction.message.id
                }
            });
        }

        // Smart Fallback 2: Match any configured ticket panel for this server
        if (!config) {
            config = await (this.client.prisma as any).ticketConfig.findFirst({
                where: {
                    guildId: interaction.guild.id
                }
            });
        }

        if (!config) {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross || '❌'} This ticket panel is no longer configured.`, 
                ephemeral: true 
            });
        }

        // Fetch option config
        const optionInfo = await (this.client.prisma as any).ticketPanelOption.findUnique({
            where: {
                panelId_optionId: {
                    panelId: config.id,
                    optionId: selectedOption
                }
            }
        });

        if (!optionInfo) {
            return await interaction.reply({ 
                content: `${this.client.emoji.cross || '❌'} This ticket option is no longer valid.`, 
                ephemeral: true 
            });
        }

        // Fetch target config if this option points to another panel
        let targetConfig = config;
        if (optionInfo.targetPanelId) {
            const targetPanel = await (this.client.prisma as any).ticketConfig.findUnique({
                where: { guildId_panelId: { guildId: interaction.guild.id, panelId: optionInfo.targetPanelId } }
            });
            if (targetPanel) {
                targetConfig = targetPanel;
            }
        }

        // Increment Ticket Count & Fetch Next ID
        const updatedConfig = await (this.client.prisma as any).ticketConfig.update({
            where: { id: config.id },
            data: { ticketCount: { increment: 1 } }
        });

        const ticketId = updatedConfig.ticketCount.toString().padStart(4, '0');
        const nameFormat = targetConfig.ticketNameFormat || config.ticketNameFormat || 'ticket-{id}';
        const channelName = nameFormat
            .replace('{id}', ticketId)
            .replace('{user}', interaction.user.username)
            .replace('{panel}', optionInfo.label.toLowerCase().replace(/\s+/g, '-'));
		
		const categoryId = optionInfo.categoryId || targetConfig.categoryId || config.categoryId;
		const supportRoleId = optionInfo.supportRoleId || targetConfig.supportRoleId || config.supportRoleId;

		const permissionOverwrites: any[] = [
			{
				id: interaction.guild.id,
				deny: [PermissionFlagsBits.ViewChannel],
			},
			{
				id: interaction.user.id,
				allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
			}
		];

		if (supportRoleId && supportRoleId !== 'MULTI') {
			permissionOverwrites.push({
				id: supportRoleId,
				allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
			});
		}

		const ticketChannel = await interaction.guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			parent: (categoryId && categoryId !== 'MULTI') ? categoryId : undefined,
			permissionOverwrites: permissionOverwrites
		});

        // Save Ticket to DB
        const ticket = await (this.client.prisma as any).ticket.create({
            data: {
                guildId: interaction.guild.id,
                channelId: ticketChannel.id,
                userId: interaction.user.id,
                status: 'OPEN',
                number: updatedConfig.ticketCount,
                panelId: optionInfo.targetPanelId || panelId
            }
        });

        // Parse custom fields if any
        let customFields = [];
        try {
            if (targetConfig.welcomeFields) {
                customFields = JSON.parse(targetConfig.welcomeFields);
            }
        } catch (e) {
            console.error("Failed to parse welcomeFields", e);
        }

        const rawDesc = (targetConfig.welcomeDescription || targetConfig.welcomeMessage || 'Hello {userMention}, welcome to your support ticket. Our staff will be with you shortly.')
            .replace(/{userMention}/g, interaction.user.toString())
            .replace(/{user_mention}/g, interaction.user.toString())
            .replace(/{user\.mention}/g, interaction.user.toString())
            .replace(/{user}/g, interaction.user.toString())
            .replace(/{username}/g, interaction.user.username)
            .replace(/{user\.name}/g, interaction.user.username)
            .replace(/{server}/g, interaction.guild.name)
            .replace(/{guild}/g, interaction.guild.name);

        // Always render as clean Borderless V2 Component Dashboard Card
        const ticketLayout = V2Helper.createLayout({
            title: targetConfig.welcomeTitle || 'Ticket Dashboard',
            description: rawDesc,
            fields: [
                { name: 'Creator', value: interaction.user.toString(), inline: true },
                { name: 'Category', value: optionInfo.label, inline: true },
                { name: 'Claimed By', value: 'Unclaimed', inline: true },
                ...customFields
            ],
            color: targetConfig.welcomeColor || this.client.color.main,
            image: targetConfig.welcomeImage,
            thumbnail: targetConfig.welcomeThumbnail,
            footer: targetConfig.welcomeFooterText || 'Encl Ticket System',
            authorName: targetConfig.welcomeAuthorName,
            authorIcon: targetConfig.welcomeAuthorIcon,
            authorUrl: targetConfig.welcomeAuthorUrl,
            timestamp: true,
            borderless: true,
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
                    .setEmoji(this.client.emoji?.edit || '📝')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`ticket_add`)
                    .setLabel('Add User')
                    .setStyle(ButtonStyle.Secondary)
            ]
        });

        const pingContent = (supportRoleId && supportRoleId !== 'MULTI') ? `${interaction.user} | <@&${supportRoleId}>` : `${interaction.user}`;

		await ticketChannel.send({ 
            content: pingContent, 
            ...(ticketLayout as any)
        });

		await interaction.reply({ 
            ...V2Helper.createLayout({
                title: `${this.client.emoji.success || '✅'} Ticket Opened`,
                description: `Your ticket has been opened in ${ticketChannel}!`,
                isAlert: true,
                color: this.client.color.main,
                borderless: true,
                ephemeral: true
            }) as any
        });
	}
}
