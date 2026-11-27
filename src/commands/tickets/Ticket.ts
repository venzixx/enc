import { 
    PermissionFlagsBits, 
    ChannelType, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ApplicationCommandOptionType,
    TextChannel,
    EmbedBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { Resolver } from '../../utils/Resolver';
import { TicketTranscript } from '../../utils/TicketTranscript';

export default class Ticket extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'ticket',
            aliases: ['t', 'tickets', 'ticketdelete'],
            description: {
                content: 'Unified ticket management system.',
                usage: 'ticket <subcommand>',
                examples: ['ticket setup single', 'ticket close', 'ticket delete', 'ticket add @User']
            },
            category: 'tickets',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                client: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages]
            },
            options: [
                {
                    name: 'setup',
                    description: 'Set up a new ticket panel',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'single',
                            description: 'Create a single-button ticket panel',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'panel_id', description: 'Unique ID for this panel', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'name', description: 'The title displayed on the panel', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'channel', description: 'Channel to send the message in', type: ApplicationCommandOptionType.Channel, required: true, channel_types: [ChannelType.GuildText] },
                                { name: 'category', description: 'Category to create channels in', type: ApplicationCommandOptionType.Channel, required: true, channel_types: [ChannelType.GuildCategory] },
                                { name: 'role', description: 'Support role for tickets', type: ApplicationCommandOptionType.Role, required: true },
                                { name: 'description', description: 'Description on panel', type: ApplicationCommandOptionType.String, required: false },
                                { name: 'welcome', description: 'Welcome phrase upon open', type: ApplicationCommandOptionType.String, required: false }
                            ]
                        },
                        {
                            name: 'multi',
                            description: 'Create a multi-dropdown ticket panel',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'panel_id', description: 'Unique ID for this panel', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'name', description: 'The title displayed on the panel', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'channel', description: 'Channel to send the message in', type: ApplicationCommandOptionType.Channel, required: true, channel_types: [ChannelType.GuildText] },
                                { name: 'description', description: 'Description on panel', type: ApplicationCommandOptionType.String, required: false }
                            ]
                        }
                    ]
                },
                {
                    name: 'add-option',
                    description: 'Add a dropdown option to a multi panel',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'panel_id', description: 'ID of the multi panel', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'option_id', description: 'Unique ID for this option', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'label', description: 'Label shown in the dropdown', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'category', description: 'Category to create tickets under', type: ApplicationCommandOptionType.Channel, required: true, channel_types: [ChannelType.GuildCategory] },
                        { name: 'role', description: 'Support role to ping', type: ApplicationCommandOptionType.Role, required: true },
                        { name: 'emoji', description: 'Emoji for dropdown (Optional)', type: ApplicationCommandOptionType.String, required: false }
                    ]
                },
                {
                    name: 'close',
                    description: 'Close the current ticket',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'delete',
                    description: 'Instantly delete the ticket channel and archive transcript',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'add',
                    description: 'Add a user to the ticket',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'user', description: 'The user to add', type: ApplicationCommandOptionType.User, required: true }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove a user from the ticket',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'user', description: 'The user to remove', type: ApplicationCommandOptionType.User, required: true }
                    ]
                },
                {
                    name: 'rename',
                    description: 'Rename the ticket channel',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'name', description: 'The new name for the channel', type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: 'claim',
                    description: 'Claim the current ticket',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const group = ctx.options.getSubcommandGroup();
        const sub = ctx.options.getSubcommand();

        const invokedName = ctx.isInteraction ? 'ticket' : ((ctx as any).commandName || 'ticket');
        if (invokedName === 'ticketdelete') {
            return this.handleDelete(client, ctx);
        }

        if (group === 'setup') {
            if (sub === 'single') return this.handleSetupSingle(client, ctx);
            if (sub === 'multi') return this.handleSetupMulti(client, ctx);
        }

        if (sub === 'add-option') return this.handleAddOption(client, ctx);
        if (sub === 'close') return this.handleClose(client, ctx);
        if (sub === 'delete') return this.handleDelete(client, ctx);
        if (sub === 'add') return this.handleAdd(client, ctx);
        if (sub === 'remove') return this.handleRemove(client, ctx);
        if (sub === 'rename') return this.handleRename(client, ctx);
        if (sub === 'claim') return this.handleClaim(client, ctx);

        // Fallback for prefix
        const pSub = args[0]?.toLowerCase();
        if (pSub === 'setup') {
            const pSub2 = args[1]?.toLowerCase();
            if (pSub2 === 'single') return this.handleSetupSingle(client, ctx);
            if (pSub2 === 'multi') return this.handleSetupMulti(client, ctx);
        }
        if (pSub === 'close') return this.handleClose(client, ctx);
        if (pSub === 'delete') return this.handleDelete(client, ctx);
        if (pSub === 'add') return this.handleAdd(client, ctx);
        if (pSub === 'remove') return this.handleRemove(client, ctx);
        if (pSub === 'rename') return this.handleRename(client, ctx);
        if (pSub === 'claim') return this.handleClaim(client, ctx);

        return ctx.replyV2({ 
            title: `${client.emoji.info || 'ℹ️'} Ticket Command Help`,
            description: 'Please use a valid subcommand: `setup`, `close`, `delete`, `add`, `remove`, `rename`, `claim`.', 
            isAlert: true,
            borderless: true,
            color: null 
        });
    }

    private async handleSetupSingle(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Permission Denied`,
                description: 'Only server administrators can setup tickets.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }
        
        const panelId = ctx.options.getString('panel_id') || (ctx as any).args[2];
        const name = ctx.options.getString('name') || (ctx as any).args[3];
        const channelId = ctx.options.getChannel('channel') || (ctx as any).args[4];
        const categoryId = ctx.options.getChannel('category') || (ctx as any).args[5];
        const roleId = ctx.options.getRole('role') || (ctx as any).args[6];

        if (!panelId || !name || !channelId || !categoryId || !roleId) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Missing Arguments`,
                description: 'Missing required arguments for single setup: `panel_id`, `name`, `channel`, `category`, `role`.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        const channel = ctx.guild.channels.cache.get(channelId.id || channelId) as any;
        const category = ctx.guild.channels.cache.get(categoryId.id || categoryId) as any;
        const role = ctx.guild.roles.cache.get(roleId.id || roleId) as any;

        const description = ctx.options.getString('description') || 'Click the button below to open a ticket.';
        const welcome = ctx.options.getString('welcome') || 'Hello {user}, welcome to your support ticket. Our staff will be with you shortly.';

        const panelV2 = await channel.send(V2Helper.createLayout({
            title: `🎟️ ${name}`,
            description: description,
            footer: `Powered by ${client.user?.username}`,
            borderless: true,
            color: null,
            buttons: [
                new ButtonBuilder()
                    .setCustomId(`ticket_open_${panelId}`)
                    .setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Primary)
            ]
        }));

        await (client.prisma as any).ticketConfig.upsert({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } },
            update: {
                name, description, categoryId: category.id, supportRoleId: role.id,
                channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false, useV2: true
            },
            create: {
                guildId: ctx.guild.id, panelId, name, description, categoryId: category.id, 
                supportRoleId: role.id, channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false, useV2: true
            }
        });

        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} Setup Complete`, 
            description: `Single ticket panel **${name}** set up in ${channel}.`, 
            borderless: true,
            color: null 
        });
    }

    private async handleSetupMulti(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Permission Denied`,
                description: 'Only server administrators can setup tickets.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }
        
        const panelId = ctx.options.getString('panel_id') || (ctx as any).args[2];
        const name = ctx.options.getString('name') || (ctx as any).args[3];
        const channelId = ctx.options.getChannel('channel') || (ctx as any).args[4];

        if (!panelId || !name || !channelId) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Missing Arguments`,
                description: 'Missing required arguments for multi setup: `panel_id`, `name`, `channel`.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        const channel = ctx.guild.channels.cache.get(channelId.id || channelId) as any;
        const description = ctx.options.getString('description') || 'Select a category from the dropdown below to open a ticket.';

        const panelV2 = await channel.send(V2Helper.createLayout({
            title: `🎟️ ${name}`,
            description: description + '\n\n*(Currently no options. Use `/ticket add-option` to add some)*',
            footer: `Powered by ${client.user?.username}`,
            borderless: true,
            color: null
        }));

        await (client.prisma as any).ticketConfig.upsert({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } },
            update: { name, description, channelId: channel.id, messageId: panelV2.id, isMulti: true, useV2: true },
            create: { 
                guildId: ctx.guild.id, 
                panelId, 
                name, 
                description, 
                channelId: channel.id, 
                messageId: panelV2.id, 
                isMulti: true,
                categoryId: 'MULTI',
                supportRoleId: 'MULTI',
                useV2: true
            }
        });

        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} Multi-Panel Created`, 
            description: `Multi ticket panel **${name}** set up in ${channel}. Use \`/ticket add-option\` to configure categories.`, 
            borderless: true,
            color: null 
        });
    }

    private async handleAddOption(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Permission Denied`,
                description: 'Only server administrators can manage ticket options.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        const panelId = ctx.options.getString('panel_id') || (ctx as any).args[2];
        const optionId = ctx.options.getString('option_id') || (ctx as any).args[3];
        const label = ctx.options.getString('label') || (ctx as any).args[4];
        const categoryId = ctx.options.getChannel('category') || (ctx as any).args[5];
        const roleId = ctx.options.getRole('role') || (ctx as any).args[6];
        const emoji = ctx.options.getString('emoji') || (ctx as any).args[7] || null;

        if (!panelId || !optionId || !label || !categoryId || !roleId) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Missing Arguments`,
                description: 'Missing required arguments for add-option.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        const category = ctx.guild.channels.cache.get(categoryId.id || categoryId) as any;
        const role = ctx.guild.roles.cache.get(roleId.id || roleId) as any;

        const panelConf = await (client.prisma as any).ticketConfig.findUnique({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } }
        });

        if (!panelConf || !panelConf.isMulti) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Panel Not Found`,
                description: `Panel \`${panelId}\` not found or is not a Multi-Panel.`, 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        await (client.prisma as any).ticketPanelOption.upsert({
            where: {
                panelId_optionId: {
                    panelId: panelConf.id,
                    optionId: optionId
                }
            },
            update: { label, categoryId: category.id, supportRoleId: role.id, emoji },
            create: { panelId: panelConf.id, optionId, label, categoryId: category.id, supportRoleId: role.id, emoji }
        });

        // Refresh panel message
        const panelChannel = ctx.guild.channels.cache.get(panelConf.channelId) as any;
        if (panelChannel && panelConf.messageId) {
            const panelMessage = await panelChannel.messages.fetch(panelConf.messageId).catch(() => null);
            const allOptions = await (client.prisma as any).ticketPanelOption.findMany({
                where: { panelId: panelConf.id }
            });

            if (panelMessage && allOptions.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`ticket_multi_${panelConf.panelId}`)
                    .setPlaceholder('Select a category to open a ticket')
                    .addOptions(allOptions.map((opt: any) => ({
                        label: opt.label,
                        value: opt.optionId,
                        emoji: opt.emoji || undefined
                    })));

                await panelMessage.edit(V2Helper.createLayout({
                    title: `🎟️ ${panelConf.name}`,
                    description: panelConf.description,
                    footer: `Powered by ${client.user?.username}`,
                    borderless: true,
                    color: null,
                    selectMenu: selectMenu
                }) as any).catch(() => {});
            }
        }

        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} Option Added`, 
            description: `Added **${label}** to Panel \`${panelId}\` and refreshed the panel message.`, 
            borderless: true,
            color: null 
        });
    }

    private async handleClose(client: ExtendedClient, ctx: Context) {
        if (!ctx.guild || !ctx.channel) return;

        const ticket = await (client.prisma as any).ticket.findUnique({ 
            where: { channelId: ctx.channel.id } 
        });

        if (!ticket) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Invalid Channel`,
                description: 'This channel is not a registered ticket.', 
                isAlert: true,
                borderless: true,
                color: null 
            });
        }

        if (ticket.status === 'CLOSED') {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Already Closing`,
                description: 'This ticket is already in the process of closing.', 
                isAlert: true,
                borderless: true,
                color: null 
            });
        }

        // Persistent Borderless V2 Close Confirmation
        const closePayload = V2Helper.createLayout({
            title: '🔒 Ticket Close Confirmation',
            description: `Are you sure you want to close this ticket?\n\n**Note:** An HTML transcript will be archived, and this channel will be closed.\n\n<@${ticket.userId}> or Support Staff, please confirm below.`,
            isAlert: true,
            borderless: true,
            color: null,
            buttons: [
                new ButtonBuilder()
                    .setCustomId('ticket_confirm_close')
                    .setLabel('Confirm Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_cancel_close')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            ]
        });

        return await ctx.replyV2(closePayload);
    }

    private async handleDelete(client: ExtendedClient, ctx: Context) {
        if (!ctx.guild || !ctx.channel) return;

        const ticket = await (client.prisma as any).ticket.findUnique({ 
            where: { channelId: ctx.channel.id } 
        });

        if (!ticket) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Invalid Channel`,
                description: 'This channel is not a registered ticket.', 
                borderless: true,
                color: null,
                isAlert: true 
            });
        }

        const member = ctx.member as any;
        const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageChannels);
        let config = null;
        if (ticket.panelId) {
            config = await (client.prisma as any).ticketConfig.findUnique({
                where: { guildId_panelId: { guildId: ctx.guild.id, panelId: ticket.panelId } }
            });
        }
        if (!config) {
            config = await (client.prisma as any).ticketConfig.findFirst({
                where: { guildId: ctx.guild.id }
            });
        }
        const isStaff = config?.supportRoleId ? member?.roles?.cache?.has(config.supportRoleId) : false;

        if (!isAdmin && !isStaff) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Permission Denied`,
                description: 'Only administrators and support staff can delete tickets.', 
                borderless: true,
                color: null,
                isAlert: true 
            });
        }

        // Generate transcript and log to transcript channel before deleting
        if (config?.transcriptEnabled && config?.transcriptChannelId) {
            try {
                const logChannel = await ctx.guild.channels.fetch(config.transcriptChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const transcriptFile = await TicketTranscript.generate(ctx.channel as TextChannel, ticket, {
                        closer: ctx.author,
                        closedReason: 'Ticket deleted via command'
                    });
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🗑️ Ticket Deleted & Archived')
                        .setDescription(
                            `Ticket **#${(ctx.channel as any).name}** was deleted.\n\n` +
                            `• **Creator:** <@${ticket.userId}> (\`${ticket.userId}\`)\n` +
                            `• **Deleted By:** <@${ctx.author.id}> (${ctx.author.tag})\n` +
                            `• **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        )
                        .setColor(0x9333ea);

                    await (logChannel as any).send({
                        embeds: [logEmbed],
                        files: [transcriptFile],
                        allowedMentions: { parse: [], roles: [], users: [] }
                    }).catch((err: any) => {
                        console.error('Failed to send transcript during ticket deletion:', err);
                    });
                }
            } catch (err) {
                console.error('Failed to log transcript during ticket deletion:', err);
            }
        }

        // Mark ticket closed in DB
        await (client.prisma as any).ticket.update({
            where: { id: ticket.id },
            data: { status: 'CLOSED' }
        }).catch(() => {});

        await ctx.replyV2({
            title: '🗑️ Deleting Ticket',
            description: 'This ticket is being deleted immediately...',
            borderless: true,
            color: null,
            isAlert: true
        });

        setTimeout(async () => {
            await (ctx.channel as any)?.delete(`Ticket deleted by ${ctx.author.tag}`).catch(() => {});
        }, 1500);
    }

    private async handleAdd(client: ExtendedClient, ctx: Context) {
        const target = await Resolver.resolveMember(ctx);
        if (!target) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Member Not Found`,
                description: 'Could not find that member in this server.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        await (ctx.channel as any).permissionOverwrites.edit(target.id, {
            ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true
        });

        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} User Added`,
            description: `${target} has been added to this ticket.`, 
            borderless: true,
            color: null,
            allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
        });
    }

    private async handleRemove(client: ExtendedClient, ctx: Context) {
        const target = await Resolver.resolveMember(ctx);
        if (!target) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Member Not Found`,
                description: 'Could not find that member in this server.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        await (ctx.channel as any).permissionOverwrites.delete(target.id);
        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} User Removed`,
            description: `${target} has been removed from this ticket.`, 
            borderless: true,
            color: null,
            allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
        });
    }

    private async handleRename(client: ExtendedClient, ctx: Context) {
        const name = ctx.options.getString('name') || (ctx as any).args[1];
        if (!name) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Invalid Name`,
                description: 'Please specify a new name for the ticket channel.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        await (ctx.channel as any).setName(name);
        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} Ticket Renamed`,
            description: `Ticket channel renamed to \`${name}\`.`, 
            borderless: true,
            color: null 
        });
    }

    private async handleClaim(client: ExtendedClient, ctx: Context) {
        const ticket = await (client.prisma as any).ticket.findUnique({ where: { channelId: ctx.channel.id } });
        if (!ticket) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Invalid Channel`,
                description: 'This is not a registered ticket channel.', 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }
        if (ticket.claimantId) {
            return ctx.replyV2({ 
                title: `${client.emoji.cross || '❌'} Already Claimed`,
                description: `This ticket is already claimed by <@${ticket.claimantId}>.`, 
                isAlert: true, 
                borderless: true,
                color: null 
            });
        }

        await (client.prisma as any).ticket.update({ where: { id: ticket.id }, data: { claimantId: ctx.author.id } });
        return ctx.replyV2({ 
            title: `${client.emoji.success || '✅'} Ticket Claimed`,
            description: `Ticket successfully claimed by ${ctx.author}!`, 
            borderless: true,
            color: null,
            allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
        });
    }
}
