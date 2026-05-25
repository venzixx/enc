import { 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ComponentType,
    AttachmentBuilder,
    ApplicationCommandOptionType,
    type ButtonInteraction
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { Resolver } from '../../utils/Resolver';

export default class Ticket extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'ticket',
            description: {
                content: 'Unified ticket management system.',
                usage: 'ticket <subcommand>',
                examples: ['ticket setup single', 'ticket close', 'ticket add @User']
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

        if (group === 'setup') {
            if (sub === 'single') return this.handleSetupSingle(client, ctx);
            if (sub === 'multi') return this.handleSetupMulti(client, ctx);
        }

        if (sub === 'add-option') return this.handleAddOption(client, ctx);
        if (sub === 'close') return this.handleClose(client, ctx);
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
        if (pSub === 'add') return this.handleAdd(client, ctx);
        if (pSub === 'remove') return this.handleRemove(client, ctx);
        if (pSub === 'rename') return this.handleRename(client, ctx);
        if (pSub === 'claim') return this.handleClaim(client, ctx);

        return ctx.replyV2({ description: 'Please use a valid subcommand: `setup`, `close`, `add`, `remove`, `rename`, `claim`.', isAlert: true });
    }

    private async handleSetupSingle(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) return ctx.replyV2({ description: 'Only Admins can setup tickets.', isAlert: true });
        
        const panelId = ctx.options.getString('panel_id') || (ctx as any).args[2];
        const name = ctx.options.getString('name') || (ctx as any).args[3];
        const channelId = ctx.options.getChannel('channel') || (ctx as any).args[4];
        const categoryId = ctx.options.getChannel('category') || (ctx as any).args[5];
        const roleId = ctx.options.getRole('role') || (ctx as any).args[6];

        if (!panelId || !name || !channelId || !categoryId || !roleId) {
            return ctx.replyV2({ description: 'Missing required arguments for single setup.', isAlert: true });
        }

        const channel = ctx.guild.channels.cache.get(channelId.id || channelId) as any;
        const category = ctx.guild.channels.cache.get(categoryId.id || categoryId) as any;
        const role = ctx.guild.roles.cache.get(roleId.id || roleId) as any;

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

        await (client.prisma as any).ticketConfig.upsert({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } },
            update: {
                name, description, categoryId: category.id, supportRoleId: role.id,
                channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false
            },
            create: {
                guildId: ctx.guild.id, panelId, name, description, categoryId: category.id, 
                supportRoleId: role.id, channelId: channel.id, messageId: panelV2.id, welcomeMessage: welcome, isMulti: false
            }
        });

        return ctx.replyV2({ title: 'Setup Complete', description: `Single ticket panel **${name}** set up in ${channel}.`, color: client.color.main });
    }

    private async handleSetupMulti(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) return ctx.replyV2({ description: 'Only Admins can setup tickets.', isAlert: true });
        
        const panelId = ctx.options.getString('panel_id') || (ctx as any).args[2];
        const name = ctx.options.getString('name') || (ctx as any).args[3];
        const channelId = ctx.options.getChannel('channel') || (ctx as any).args[4];

        if (!panelId || !name || !channelId) {
            return ctx.replyV2({ description: 'Missing required arguments for multi setup.', isAlert: true });
        }

        const channel = ctx.guild.channels.cache.get(channelId.id || channelId) as any;
        const description = ctx.options.getString('description') || 'Select a category from the dropdown below to open a ticket.';

        const panelV2 = await channel.send(V2Helper.createLayout({
            title: ` ${name}`,
            description: description + '\n\n*(Currently no options. Use `/ticket add-option` to add some)*',
            footer: `Powered by ${client.user?.username}`,
            color: client.color.main
        }));

        await (client.prisma as any).ticketConfig.upsert({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } },
            update: { name, description, channelId: channel.id, messageId: panelV2.id, isMulti: true },
            create: { 
                guildId: ctx.guild.id, 
                panelId, 
                name, 
                description, 
                channelId: channel.id, 
                messageId: panelV2.id, 
                isMulti: true,
                categoryId: 'MULTI', // Placeholder since it's required in some versions of schema or logic
                supportRoleId: 'MULTI' // Placeholder
            }
        });

        return ctx.replyV2({ title: 'Multi-Panel Created', description: `Multi ticket panel **${name}** set up in ${channel}.`, color: client.color.main });
    }

    private async handleAddOption(client: ExtendedClient, ctx: Context) {
        if (!ctx.member?.permissions.has(PermissionFlagsBits.Administrator)) return ctx.replyV2({ description: 'Only Admins can manage ticket options.', isAlert: true });

        const panelId = ctx.options.getString('panel_id');
        const optionId = ctx.options.getString('option_id');
        const label = ctx.options.getString('label');
        const categoryId = ctx.options.getChannel('category') as any;
        const roleId = ctx.options.getRole('role') as any;
        const emoji = ctx.options.getString('emoji');

        if (!panelId || !optionId || !label || !categoryId || !roleId) return ctx.replyV2({ description: 'Missing arguments.', isAlert: true });

        const panelConf = await (client.prisma as any).ticketConfig.findUnique({
            where: { guildId_panelId: { guildId: ctx.guild.id, panelId: panelId } },
            include: { options: true }
        });

        if (!panelConf || !panelConf.isMulti) return ctx.replyV2({ description: 'Multi-panel not found.', isAlert: true });

        await (client.prisma as any).ticketPanelOption.upsert({
            where: { panelId_optionId: { panelId: panelConf.id, optionId: optionId } },
            update: { label, categoryId: categoryId.id, supportRoleId: roleId.id, emoji },
            create: { panelId: panelConf.id, optionId: optionId, label, categoryId: categoryId.id, supportRoleId: roleId.id, emoji }
        });

        // Refresh panel message
        const channel = ctx.guild.channels.cache.get(panelConf.channelId) as any;
        const message = await channel?.messages.fetch(panelConf.messageId).catch(() => null);

        if (message) {
            const allOptions = await (client.prisma as any).ticketPanelOption.findMany({
                where: { panelId: panelConf.id }
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`ticket_multi_${panelConf.panelId}`)
                .setPlaceholder('Select a category to open a ticket')
                .addOptions(allOptions.map((o: any) => ({
                    label: o.label,
                    value: o.optionId,
                    emoji: o.emoji || undefined
                })));

            await message.edit({
                embeds: [EmbedBuilder.from(message.embeds[0]).setDescription(panelConf.description)],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
            });
        }

        return ctx.replyV2({ title: 'Option Added', description: `Added **${label}** to Panel \`${panelId}\` and refreshed the panel.`, color: client.color.main });
    }

    private async handleClose(client: ExtendedClient, ctx: Context) {
        const ticket = await (client.prisma as any).ticket.findUnique({ where: { channelId: ctx.channel.id } });
        if (!ticket) return ctx.replyV2({ description: 'This channel is not a registered ticket.', isAlert: true });

        // Fetch TicketConfig
        let config = null;
        if (ticket.panelId) {
            config = await (client.prisma as any).ticketConfig.findUnique({
                where: {
                    guildId_panelId: {
                        guildId: ticket.guildId,
                        panelId: ticket.panelId
                    }
                }
            });
        }
        if (!config) {
            config = await (client.prisma as any).ticketConfig.findFirst({
                where: { guildId: ticket.guildId }
            });
        }

        const useV2 = config ? config.useV2 : false;
        const transcriptEnabled = config ? config.transcriptEnabled : true;
        const transcriptDM = config ? config.transcriptDM : true;
        const transcriptChannelId = config ? config.transcriptChannelId : null;

        // Deciding Close Confirmation Layout based on useV2
        let closePayload: any = {};
        if (useV2) {
            closePayload = V2Helper.createLayout({
                title: ' Close Confirmation',
                description: `Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be sent based on panel settings, and the channel will be deleted.\n\n<@${ticket.userId}>, please confirm if this ticket can be closed.`,
                isAlert: true,
                color: 0xFFA500,
                buttons: [
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                ]
            }) as any;
        } else {
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Close Confirmation')
                .setDescription(`Are you sure you want to close this ticket?\n\n**Note:** Transcripts will be sent based on panel settings, and the channel will be deleted.\n\n<@${ticket.userId}>, please confirm if this ticket can be closed.`)
                .setColor(0xFFA500);

            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            closePayload = {
                embeds: [confirmEmbed],
                components: [confirmRow]
            };
        }

        const response = await ctx.reply({ 
            ...closePayload,
            fetchReply: true
        });

        const collector = (response as any).createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.customId === 'cancel_close') {
                if (i.user.id !== ticket.userId && !i.memberPermissions?.has('Administrator')) {
                    return await i.reply({ content: `${client.emoji.cross} Only the ticket creator or an Admin can cancel the closure.`, ephemeral: true });
                }
                if (useV2) {
                    await i.update({ 
                        ...V2Helper.createLayout({
                            title: 'Closure Cancelled',
                            description: 'The ticket will remain open.',
                            isAlert: false,
                            color: 0x22c55e
                        }) as any,
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        embeds: [new EmbedBuilder().setTitle('Closure Cancelled').setDescription('The ticket will remain open.').setColor(0x22c55e)],
                        components: [] 
                    });
                }
                return collector.stop('cancelled');
            }
            if (i.customId === 'confirm_close') {
                if (useV2) {
                    await i.update({ 
                        ...V2Helper.createLayout({
                            title: 'Closing Ticket',
                            description: 'Generating transcript and closing...',
                            isAlert: true,
                            color: 0xFFA500
                        }) as any,
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        embeds: [new EmbedBuilder().setTitle('Closing Ticket').setDescription('Generating transcript and closing...').setColor(0xFFA500)],
                        components: [] 
                    });
                }
                collector.stop('confirmed');
            }
        });

        collector.on('end', async (collected: any, reason: string) => {
            if (reason === 'cancelled') return;

            const channel = ctx.channel as any;
            if (!channel) return;

            // Generate Transcript
            let transcriptFile: AttachmentBuilder | null = null;
            if (transcriptEnabled) {
                const messages = await channel.messages.fetch({ limit: 100 });
                const transcriptContent = messages.reverse().map((m: any) => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || (m.embeds.length > 0 ? '[Embed]' : '[No Content]')}`
                ).join('\n');

                transcriptFile = new AttachmentBuilder(Buffer.from(transcriptContent), { name: `transcript-${channel.name}.txt` });
            }

            if (transcriptEnabled && transcriptFile) {
                // DM Creator
                if (transcriptDM) {
                    try {
                        const creator = await ctx.guild.members.fetch(ticket.userId);
                        if (creator) {
                            await creator.send({ 
                                content: `Your ticket **#${channel.name}** in **${ctx.guild.name}** has been closed. Here is your transcript:`,
                                files: [transcriptFile]
                            });
                        }
                    } catch (err) {
                        console.log('Failed to DM transcript to user:', err);
                    }
                }

                // Send to log channel
                if (transcriptChannelId) {
                    try {
                        const logChannel = await ctx.guild.channels.fetch(transcriptChannelId);
                        if (logChannel && logChannel.isTextBased()) {
                            await (logChannel as any).send({
                                content: `Transcript for closed ticket **#${channel.name}** (Opened by <@${ticket.userId}>):`,
                                files: [transcriptFile]
                            });
                        }
                    } catch (err) {
                        console.log('Failed to send transcript to log channel:', err);
                    }
                }
            }

            // Update DB
            await (client.prisma as any).ticket.update({
                where: { id: ticket.id },
                data: { status: 'CLOSED' }
            });

            // Delete Channel after a short delay
            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
        });
    }

    private async handleAdd(client: ExtendedClient, ctx: Context) {
        const target = await Resolver.resolveMember(ctx);
        if (!target) return ctx.replyV2({ description: 'Member not found.', isAlert: true });

        await (ctx.channel as any).permissionOverwrites.edit(target.id, {
            ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true
        });

        return ctx.replyV2({ description: `${target} has been added to the ticket.`, color: client.color.main });
    }

    private async handleRemove(client: ExtendedClient, ctx: Context) {
        const target = await Resolver.resolveMember(ctx);
        if (!target) return ctx.replyV2({ description: 'Member not found.', isAlert: true });

        await (ctx.channel as any).permissionOverwrites.delete(target.id);
        return ctx.replyV2({ description: `${target} has been removed from the ticket.`, color: client.color.main });
    }

    private async handleRename(client: ExtendedClient, ctx: Context) {
        const name = ctx.options.getString('name') || (ctx as any).args[1];
        if (!name) return ctx.replyV2({ description: 'Please specify a new name.', isAlert: true });

        await (ctx.channel as any).setName(name);
        return ctx.replyV2({ description: `Ticket renamed to \`${name}\`.`, color: client.color.main });
    }

    private async handleClaim(client: ExtendedClient, ctx: Context) {
        const ticket = await (client.prisma as any).ticket.findUnique({ where: { channelId: ctx.channel.id } });
        if (!ticket) return ctx.replyV2({ description: 'Not a ticket channel.', isAlert: true });
        if (ticket.claimantId) return ctx.replyV2({ description: `Already claimed by <@${ticket.claimantId}>.`, isAlert: true });

        await (client.prisma as any).ticket.update({ where: { id: ticket.id }, data: { claimantId: ctx.author.id } });
        return ctx.replyV2({ description: `Ticket claimed by ${ctx.author}!`, color: client.color.main });
    }
}
