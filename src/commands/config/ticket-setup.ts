import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class TicketSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ticket-setup',
			description: {
				content: 'Set up ticket panels (single or multi-dropdown).',
				usage: 'ticket-setup <single|multi>',
				examples: ['ticket-setup single support "Support Tickets" #tickets #category @Support']
			},
			category: 'tickets',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageChannels]
			},
			options: [
				{
					name: 'single',
					description: 'Create a standard single-button ticket panel',
					type: 1, // SUB_COMMAND
					options: [
						{ name: 'panel_id', description: 'Unique ID for this panel', type: 3, required: true },
						{ name: 'name', description: 'The title displayed on the panel', type: 3, required: true },
						{ name: 'channel', description: 'Channel to send the message in', type: 7, required: true, channel_types: [ChannelType.GuildText] },
						{ name: 'category', description: 'Category to create channels in', type: 7, required: true, channel_types: [ChannelType.GuildCategory] },
						{ name: 'role', description: 'Support role for tickets', type: 8, required: true },
						{ name: 'description', description: 'Description on panel', type: 3, required: false },
						{ name: 'welcome', description: 'Welcome phrase upon open', type: 3, required: false }
					]
				},
				{
					name: 'multi',
					description: 'Create a multi-dropdown ticket panel',
					type: 1, // SUB_COMMAND
					options: [
						{ name: 'panel_id', description: 'Unique ID for this panel', type: 3, required: true },
						{ name: 'name', description: 'The title displayed on the panel', type: 3, required: true },
						{ name: 'channel', description: 'Channel to send the message in', type: 7, required: true, channel_types: [ChannelType.GuildText] },
						{ name: 'description', description: 'Description on panel', type: 3, required: false }
					]
				},
                {
                    name: 'add-option',
                    description: 'Add a dropdown option to a multi panel',
                    type: 1,
                    options: [
                        { name: 'panel_id', description: 'ID of the multi panel to add an option to', type: 3, required: true },
                        { name: 'option_id', description: 'Unique ID for this option (e.g., billing, support)', type: 3, required: true },
                        { name: 'label', description: 'Label shown in the dropdown menu', type: 3, required: true },
                        { name: 'category', description: 'Category to create tickets under for this option', type: 7, required: true, channel_types: [ChannelType.GuildCategory] },
						{ name: 'role', description: 'Support role to ping for this option', type: 8, required: true },
                        { name: 'emoji', description: 'Emoji for dropdown (Optional)', type: 3, required: false }
                    ]
                }
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply(true);
        const sub = ctx.options.getSubcommand();

        if (sub === 'single') {
            const panelId = ctx.options.getString('panel_id')!;
            const name = ctx.options.getString('name')!;
            const channelId = ctx.options.getChannel('channel') as string;
            const categoryId = ctx.options.getChannel('category') as string;
            const roleId = ctx.options.getRole('role') as string;
            
            const channel = ctx.guild.channels.cache.get(channelId) as any;
            const category = ctx.guild.channels.cache.get(categoryId) as any;
            const role = ctx.guild.roles.cache.get(roleId) as any;

            if (!channel || !category || !role) {
                return await ctx.editReplyV2({ description: 'Failed to find channel, category or role in cache.', color: client.color.red, isAlert: true });
            }

            const description = ctx.options.getString('description') || 'Click the button below to open a ticket.';
            const welcome = ctx.options.getString('welcome') || 'Hello {user}, welcome to your support ticket. Our staff will be with you shortly.';

            const panelV2 = await channel.send(V2Helper.createLayout({
                title: ` ${name}`,
                description: description,
                footer: `Powered by ${client.user?.username}`,
                color: client.color.main,
                buttons: [
                    new ButtonBuilder()
                        .setCustomId(`ticket_open_${panelId}`)
                        .setLabel('Open Ticket')
                        .setStyle(ButtonStyle.Secondary)
                ]
            }));

            // Save to Database
            await (client.prisma as any).ticketConfig.upsert({
                where: { guildId_panelId: { guildId: ctx.guild?.id!, panelId: panelId } },
                update: {
                    name, description, categoryId: category.id, supportRoleId: role.id,
                    channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false
                },
                create: {
                    guildId: ctx.guild?.id!, panelId, name, description, categoryId: category.id, 
                    supportRoleId: role.id, channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false
                }
            });

            return await ctx.editReplyV2({ 
                title: `${client.emoji.success} Setup Complete`, 
                description: `Single ticket panel **${name}** (ID: \`${panelId}\`) has been set up in ${channel}.`,
                color: client.color.main
            });
        }

        if (sub === 'multi') {
            const panelId = ctx.options.getString('panel_id')!;
            const name = ctx.options.getString('name')!;
            const channelId = ctx.options.getChannel('channel') as string;
            const channel = ctx.guild.channels.cache.get(channelId) as any;
            
            if (!channel) return await ctx.editReplyV2({ description: 'Channel not found.', color: client.color.red, isAlert: true });

            const description = ctx.options.getString('description') || 'Select a category from the dropdown below to open a ticket.';

            const panelV2 = await channel.send(V2Helper.createLayout({
                title: ` ${name}`,
                description: description + '\n\n*(Currently no options. Use `/ticket-setup add-option` to add some)*',
                footer: `Powered by ${client.user?.username}`,
                color: client.color.main
            }));

            // Save to Database
            await (client.prisma as any).ticketConfig.upsert({
                where: { guildId_panelId: { guildId: ctx.guild?.id!, panelId: panelId } },
                update: {
                    name, description, channelId: channel.id, messageId: panelV2.id, isMulti: true
                },
                create: {
                    guildId: ctx.guild?.id!, panelId, name, description, channelId: channel.id, messageId: panelV2.id, isMulti: true
                }
            });

            return await ctx.editReplyV2({ 
                title: `${client.emoji.success} Multi-Panel Created`, 
                description: `Multi ticket panel **${name}** (ID: \`${panelId}\`) has been set up in ${channel}. \n\n**Next step:** Run \`/ticket-setup add-option\` to configure the dropdown menu options.`,
                color: client.color.main
            });
        }

        if (sub === 'add-option') {
            const panelId = ctx.options.getString('panel_id')!;
            const optionId = ctx.options.getString('option_id')!;
            const label = ctx.options.getString('label')!;
            const categoryId = ctx.options.getChannel('category') as string;
            const roleId = ctx.options.getRole('role') as string;
            const emoji = ctx.options.getString('emoji');

            const category = ctx.guild.channels.cache.get(categoryId);
            if (!category) return await ctx.editReplyV2({ description: 'Category not found.', color: client.color.red, isAlert: true });

            const panelConf = await (client.prisma as any).ticketConfig.findUnique({
                where: { guildId_panelId: { guildId: ctx.guild?.id!, panelId: panelId } },
                include: { options: true }
            });

            if (!panelConf || !panelConf.isMulti) {
                return await ctx.editReplyV2({ description: `Panel \`${panelId}\` not found or is not a multi-panel.`, color: client.color.red, isAlert: true });
            }

            if (panelConf.options.length >= 5) {
                return await ctx.editReplyV2({ description: `Multi-panels can only have up to 5 options.`, color: client.color.red, isAlert: true });
            }

            await (client.prisma as any).ticketPanelOption.upsert({
                where: { panelId_optionId: { panelId: panelConf.id, optionId: optionId } },
                update: { label, categoryId: category.id, supportRoleId: roleId, emoji },
                create: { panelId: panelConf.id, optionId: optionId, label, categoryId: category.id, supportRoleId: roleId, emoji }
            });

            // Update Panel Message
            const channel = ctx.guild.channels.cache.get(panelConf.channelId) as any;
            if (channel) {
                const message = await channel.messages.fetch(panelConf.messageId).catch(() => null);
                if (message) {
                    // Refetch options
                    const updatedConf = await (client.prisma as any).ticketConfig.findUnique({
                        where: { id: panelConf.id },
                        include: { options: true }
                    });

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`ticket_multi_${panelId}`)
                        .setPlaceholder('Select a ticket category...')
                        .addOptions(updatedConf.options.map((opt: any) => ({
                            label: opt.label,
                            description: `Open a ${opt.label} ticket`,
                            value: opt.optionId,
                            emoji: opt.emoji || undefined
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await message.edit({
                        components: [row]
                    });
                }
            }

            return await ctx.editReplyV2({ 
                title: `${client.emoji.success} Option Added`, 
                description: `Successfully added **${label}** option to Panel \`${panelId}\`.`,
                color: client.color.main
            });
        }
	}
}
