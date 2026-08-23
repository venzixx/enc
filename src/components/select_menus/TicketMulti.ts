import { type StringSelectMenuInteraction, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, resolveColor } from "discord.js";
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
        let config = await (this.client.prisma as any).ticketConfig.findUnique({
            where: { guildId_panelId: { guildId: interaction.guild.id, panelId: panelId } },
            include: { options: true }
        });

        // Smart Fallback 1: Match by message ID
        if (!config && interaction.message) {
            config = await (this.client.prisma as any).ticketConfig.findFirst({
                where: { guildId: interaction.guild.id, messageId: interaction.message.id },
                include: { options: true }
            });
        }

        // Smart Fallback 2: Match any multi ticket panel for this server
        if (!config) {
            config = await (this.client.prisma as any).ticketConfig.findFirst({
                where: { guildId: interaction.guild.id, isMulti: true },
                include: { options: true }
            });
        }

        if (!config || !config.isMulti) {
            return await interaction.reply({ content: `${this.client.emoji.cross} This ticket panel is no longer configured.`, ephemeral: true });
        }

        const optionInfo = config.options.find((o: any) => o.optionId === optionId);
        if (!optionInfo) {
            return await interaction.reply({ content: `${this.client.emoji.cross} This ticket category is no longer valid.`, ephemeral: true });
        }

        // Fetch target config if this option points to another panel
        let targetConfig = config;
        let categoryId = optionInfo.categoryId;
        let supportRoleId = optionInfo.supportRoleId;

        if (optionInfo.targetPanelId) {
            const targetPanel = await (this.client.prisma as any).ticketConfig.findUnique({
                where: { guildId_panelId: { guildId: interaction.guild.id, panelId: optionInfo.targetPanelId } }
            });
            if (targetPanel) {
                targetConfig = targetPanel;
                if (targetPanel.categoryId) categoryId = targetPanel.categoryId;
                if (targetPanel.supportRoleId) supportRoleId = targetPanel.supportRoleId;
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

        if (supportRoleId) {
            permissionOverwrites.push({
                id: supportRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
            });
        }

		const ticketChannel = await interaction.guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			parent: categoryId || undefined,
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

		let ticketLayout: any;
        if (targetConfig.useV2) {
            ticketLayout = V2Helper.createLayout({
                title: targetConfig.welcomeTitle || 'Ticket Dashboard',
                description: (targetConfig.welcomeDescription || targetConfig.welcomeMessage || '').replace('{user}', interaction.user.toString()),
                fields: [
                    { name: 'Creator', value: interaction.user.toString(), inline: true },
                    { name: 'Category', value: optionInfo.label, inline: true },
                    { name: 'Claimed By', value: 'Unclaimed', inline: true },
                    ...customFields
                ],
                color: targetConfig.welcomeColor || this.client.color.main,
                image: targetConfig.welcomeImage,
                thumbnail: targetConfig.welcomeThumbnail,
                footer: targetConfig.welcomeFooterText,
                authorName: targetConfig.welcomeAuthorName,
                authorIcon: targetConfig.welcomeAuthorIcon,
                authorUrl: targetConfig.welcomeAuthorUrl,
                timestamp: targetConfig.welcomeTimestamp,
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
        } else {
            const embed = new EmbedBuilder()
                .setTitle(targetConfig.welcomeTitle || 'Ticket Dashboard')
                .setDescription((targetConfig.welcomeDescription || targetConfig.welcomeMessage || '').replace('{user}', interaction.user.toString()))
                .setColor(resolveColor(targetConfig.welcomeColor || this.client.color.main))
                .addFields(
                    { name: 'Creator', value: interaction.user.toString(), inline: true },
                    { name: 'Category', value: optionInfo.label, inline: true },
                    { name: 'Claimed By', value: 'Unclaimed', inline: true }
                );

            if (targetConfig.welcomeImage) embed.setImage(targetConfig.welcomeImage);
            if (targetConfig.welcomeThumbnail) embed.setThumbnail(targetConfig.welcomeThumbnail);
            if (targetConfig.welcomeFooterText) {
                embed.setFooter({ 
                    text: targetConfig.welcomeFooterText, 
                    iconURL: targetConfig.welcomeFooterIcon || undefined 
                });
            }
            if (targetConfig.welcomeAuthorName) {
                embed.setAuthor({ 
                    name: targetConfig.welcomeAuthorName, 
                    iconURL: targetConfig.welcomeAuthorIcon || undefined, 
                    url: targetConfig.welcomeAuthorUrl || undefined 
                });
            }
            if (targetConfig.welcomeTimestamp) embed.setTimestamp();
            if (customFields && customFields.length > 0) {
                embed.addFields(customFields);
            }

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            );

            ticketLayout = {
                embeds: [embed],
                components: [row]
            };
        }

        const pingContent = supportRoleId ? `${interaction.user} | <@&${supportRoleId}>` : `${interaction.user}`;

		await ticketChannel.send({ 
            content: pingContent, 
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
