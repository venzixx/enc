import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class TicketSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ticket-setup',
			description: {
				content: 'Set up a ticket panel in this server.',
				usage: 'ticket-setup <panel_id> <name> <channel> <category> <support_role> [description] [welcome_message]',
				examples: ['ticket-setup support "Support Tickets" #tickets #Support-Category @Support']
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
					name: 'panel_id',
					description: 'Unique ID for this panel (e.g. support, billing)',
					type: 3, // STRING
					required: true
				},
				{
					name: 'name',
					description: 'The title displayed on the ticket panel',
					type: 3, // STRING
					required: true
				},
				{
					name: 'channel',
					description: 'Channel to send the ticket creation message',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildText]
				},
				{
					name: 'category',
					description: 'Category to create ticket channels in',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildCategory]
				},
				{
					name: 'role',
					description: 'Support role that will have access to tickets',
					type: 8, // ROLE
					required: true
				},
				{
					name: 'description',
					description: 'Description displayed on the ticket panel',
					type: 3, // STRING
					required: false
				},
				{
					name: 'welcome',
					description: 'Message sent when a ticket is opened ({user} for mention)',
					type: 3, // STRING
					required: false
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const panelId = ctx.options.getString('panel_id');
		const name = ctx.options.getString('name');
		const channel = ctx.options.getChannel('channel') as any;
		const category = ctx.options.getChannel('category') as any;
		const role = ctx.options.getRole('role');
		const description = ctx.options.getString('description') || 'Click the button below to open a ticket.';
		const welcome = ctx.options.getString('welcome') || 'Hello {user}, welcome to your support ticket. Our staff will be with you shortly.';

        if (!panelId || !name || !channel || !category || !role) {
            return await ctx.reply({ content: 'âŒ Missing required arguments.', ephemeral: true });
        }

		const panelV2 = await (channel as any).send(V2Helper.createLayout({
            title: `ðŸŽ« ${name}`,
            description: description,
            footer: `Powered by ${_client.user?.username}`,
            color: _client.color.main,
            buttons: [
                new ButtonBuilder()
                    .setCustomId(`ticket_open_${panelId}`)
                    .setLabel('Open Ticket')
                    .setEmoji('ðŸ“©')
                    .setStyle(ButtonStyle.Secondary)
            ]
        }));

        const msg = panelV2;

        // Save to Database
        await (_client.prisma as any).ticketConfig.upsert({
            where: {
                guildId_panelId: {
                    guildId: ctx.guild?.id!,
                    panelId: panelId
                }
            },
            update: {
                name: name,
                description: description,
                categoryId: category.id,
                supportRoleId: role.id,
                channelId: channel.id,
                messageId: msg.id,
                welcomeMessage: welcome
            },
            create: {
                guildId: ctx.guild?.id!,
                panelId: panelId,
                name: name,
                description: description,
                categoryId: category.id,
                supportRoleId: role.id,
                channelId: channel.id,
                messageId: msg.id,
                welcomeMessage: welcome
            }
        });

		await ctx.replyV2({ 
            title: 'âœ… Setup Complete', 
            description: `Ticket panel **${name}** (ID: \`${panelId}\`) has been set up in ${channel}.`,
            isAlert: true,
            color: _client.color.main
        });
	}
}
