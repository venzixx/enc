import { 
    ApplicationCommandOptionType,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    CategoryChannel,
    Role,
    EmbedBuilder,
    ActionRowBuilder,
    ComponentType,
    StringSelectMenuBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class Config extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'config',
            aliases: ['settings', 'setup', 'conf', 'setting'],
            description: {
                content: 'Central configuration hub for all bot modules.',
                usage: 'config <category> <subcommand>',
                examples: ['config prefix !', 'config antinuke status']
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.Administrator, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles]
            },
            options: [
                {
                    name: 'prefix',
                    description: 'Change the custom prefix for this server.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'new_prefix', description: 'The new prefix', type: ApplicationCommandOptionType.String, required: true }]
                },
                {
                    name: 'welcome',
                    description: 'Setup the welcome messages module.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'channel', description: 'Welcome channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                        { name: 'message', description: 'Welcome message', type: ApplicationCommandOptionType.String, required: false }
                    ]
                },
                {
                    name: 'greeter',
                    description: 'Configure the greeter module',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'action', description: 'Action', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'setup', value:'setup'},{name:'message', value:'message'},{name:'time', value:'time'}] },
                        { name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: false },
                        { name: 'message', description: 'Message', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'seconds', description: 'Time in seconds', type: ApplicationCommandOptionType.Integer, required: false }
                    ]
                },
                {
                    name: 'joindm',
                    description: 'Set a message to be DMed to all new members.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'message', description: 'The DM message', type: ApplicationCommandOptionType.String, required: true }]
                },
                {
                    name: 'starboard',
                    description: 'Setup the starboard system.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'channel', description: 'Starboard channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                        { name: 'count', description: 'Stars required', type: ApplicationCommandOptionType.Integer, required: true }
                    ]
                },
                {
                    name: 'birthday',
                    description: 'Setup the birthday announcement system.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'channel', description: 'Announcement channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                        { name: 'ping_role', description: 'Role to ping', type: ApplicationCommandOptionType.Role, required: false }
                    ]
                },
                {
                    name: 'confess',
                    description: 'Setup the anonymous confession module.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'channel', description: 'Confession channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                },
                {
                    name: 'counting',
                    description: 'Set the channel for the counting minigame.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                },
                {
                    name: 'story',
                    description: 'Set the channel for the collaborative story game.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                },
                {
                    name: 'suggestion',
                    description: 'Set the channel where suggestions will be posted.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{ name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                },
                {
                    name: 'vanity',
                    description: 'Automatically assign a role to users who have a specific vanity link.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'slug', description: 'The vanity slug', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'role', description: 'Role to give', type: ApplicationCommandOptionType.Role, required: true }
                    ]
                },
                {
                    name: 'verify',
                    description: 'Set up the verification gate system.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                        { name: 'role', description: 'Role to give', type: ApplicationCommandOptionType.Role, required: true }
                    ]
                },
                {
                    name: 'autorole',
                    description: 'Manage the role automatically given to new members.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'action', description: 'Action', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'add', value:'add'},{name:'remove', value:'remove'}] },
                        { name: 'role', description: 'Role', type: ApplicationCommandOptionType.Role, required: false }
                    ]
                },
                {
                    name: 'music',
                    description: 'Set up the music song-request channel.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'action', description: 'Create or delete the music channel', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'Create', value:'create'},{name:'Delete', value:'delete'}] }
                    ]
                },
                {
                    name: 'level',
                    description: 'Configure the XP and Leveling system settings.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'action', description: 'Action', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'channel', value:'channel'},{name:'card-channel', value:'card-channel'},{name:'booster-add', value:'booster-add'},{name:'booster-remove', value:'booster-remove'},{name:'booster-list', value:'booster-list'}] },
                        { name: 'target', description: 'Target channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: false },
                        { name: 'role', description: 'Role to boost/remove', type: ApplicationCommandOptionType.Role, required: false },
                        { name: 'percentage', description: 'XP boost percentage', type: ApplicationCommandOptionType.Integer, required: false }
                    ]
                },
                {
                    name: 'log',
                    description: 'Configure guild logging categories and status.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { name: 'status', description: 'Show live logging manifest.', type: ApplicationCommandOptionType.Subcommand },
                        { 
                            name: 'setup', 
                            description: 'Configure logging system mode.', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'mode', description: 'Mode', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'Core', value:'core'},{name:'Category', value:'category'},{name:'Status', value:'status'},{name:'Disable', value:'disable'}] },
                                { name: 'target', description: 'Target channel/category', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText, ChannelType.GuildCategory], required: false }
                            ]
                        },
                        { 
                            name: 'config', 
                            description: 'Configure specific toggles.', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'category', description: 'Category', type: ApplicationCommandOptionType.String, required: true, choices: [{name:'Messages', value:'Messages'},{name:'Channels', value:'Channels'},{name:'Roles', value:'Roles'},{name:'Members', value:'Members'},{name:'Moderation', value:'Moderation'},{name:'Security', value:'Security'},{name:'Voice', value:'Voice'},{name:'Automod', value:'Automod'},{name:'Bot', value:'Bot'},{name:'Invites', value:'Invites'},{name:'Emoji', value:'Emoji'},{name:'Sticker', value:'Sticker'},{name:'Events', value:'Events'},{name:'Stage', value:'Stage'},{name:'Server', value:'Server'},{name:'Threads', value:'Threads'},{name:'Vanity', value:'Vanity'},{name:'Webhooks', value:'Webhooks'}] },
                                { name: 'toggle', description: 'Enable/disable', type: ApplicationCommandOptionType.Boolean, required: false },
                                { name: 'channel', description: 'Channel', type: ApplicationCommandOptionType.Channel, required: false }
                            ]
                        }
                    ]
                },
                {
                    name: 'streaktier',
                    description: 'Manage streak tiers for your server.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { 
                            name: 'add', 
                            description: 'Add a tier', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'name', description: 'Name', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'threshold', description: 'Threshold', type: ApplicationCommandOptionType.Integer, required: true }
                            ]
                        },
                        { 
                            name: 'remove', 
                            description: 'Remove a tier', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'threshold', description: 'Threshold', type: ApplicationCommandOptionType.Integer, required: true }]
                        },
                        { name: 'list', description: 'List tiers', type: ApplicationCommandOptionType.Subcommand }
                    ]
                },
                {
                    name: 'roleconnect',
                    description: 'Link roles together.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { 
                            name: 'add', 
                            description: 'Connect role', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'trigger', description: 'Trigger role', type: ApplicationCommandOptionType.Role, required: true },
                                { name: 'target', description: 'Target role', type: ApplicationCommandOptionType.Role, required: true }
                            ]
                        },
                        { 
                            name: 'remove', 
                            description: 'Disconnect role', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'trigger', description: 'Trigger role', type: ApplicationCommandOptionType.Role, required: true },
                                { name: 'target', description: 'Target role', type: ApplicationCommandOptionType.Role, required: true }
                            ]
                        },
                        { name: 'list', description: 'List connections', type: ApplicationCommandOptionType.Subcommand }
                    ]
                },
                {
                    name: 'autoresponder',
                    description: 'Manage automatic text responses.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        { 
                            name: 'add', 
                            description: 'Add response', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'trigger', description: 'Trigger', type: ApplicationCommandOptionType.String, required: true },
                                { name: 'response', description: 'Response', type: ApplicationCommandOptionType.String, required: true }
                            ]
                        },
                        { 
                            name: 'delete', 
                            description: 'Delete response', 
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'trigger', description: 'Trigger', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        { name: 'list', description: 'List responses', type: ApplicationCommandOptionType.Subcommand }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const group = ctx.options.getSubcommandGroup(false);
        const sub = ctx.options.getSubcommand(false);

        if (!group && !sub) {
            return ctx.replyV2(this.getDashboardLayout());
        }

        if (group) {
            switch(group) {
                case 'log': return this.handleLog(client, ctx, sub);
                case 'streaktier': return this.handleStreaktier(client, ctx, sub);
                case 'roleconnect': return this.handleRoleconnect(client, ctx, sub);
                case 'autoresponder': return this.handleAutoresponder(client, ctx, sub);
            }
        } else if (sub) {
            switch(sub) {
                case 'prefix': {
                    let newPrefix: string | null = null;
                    if (ctx.isInteraction) {
                        newPrefix = ctx.options.getString('new_prefix');
                    } else {
                        if (args[0]?.toLowerCase() === 'prefix') {
                            newPrefix = args.slice(1).join(' ').trim() || null;
                        } else {
                            newPrefix = args.join(' ').trim() || null;
                        }
                    }

                    if (!newPrefix) {
                        const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });
                        const currentPrefix = guildData?.prefix || client.config.prefix || ',';
                        return ctx.replyV2({
                            title: 'Server Prefix',
                            description: `The current server prefix is \`${currentPrefix}\`.\n\nTo change it, use:\n\`${ctx.prefix}config prefix <new_prefix>\``,
                            color: client.color.main
                        });
                    }

                    if (newPrefix.length > 5) {
                        return ctx.replyV2({
                            title: 'Invalid Prefix',
                            description: 'Prefix cannot be longer than 5 characters.',
                            isAlert: true,
                            color: client.color.red
                        });
                    }

                    await client.prisma.guild.upsert({
                        where: { id: ctx.guild.id },
                        update: { prefix: newPrefix },
                        create: { id: ctx.guild.id, prefix: newPrefix }
                    });

                    return ctx.replyV2({
                        title: 'Prefix Updated',
                        description: `Successfully updated server prefix to \`${newPrefix}\`.`,
                        color: client.color.main
                    });
                }
                case 'welcome': {
                    const channel = ctx.options.getChannel('channel', true);
                    const message = ctx.options.getString('message') || 'Welcome {user} to the server!';
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { welcomeChannelId: channel.id, welcomeMessage: message }, create: { id: ctx.guild.id, welcomeChannelId: channel.id, welcomeMessage: message } });
                    return ctx.replyV2({ title: 'Welcome Configured', description: `Successfully configured welcome messages in ${channel}.`, color: client.color.main });
                }
                case 'greeter': {
                    const action = ctx.options.getString('action', true);
                    if (action === 'setup') {
                        const channel = ctx.options.getChannel('channel');
                        if (!channel) return ctx.replyV2({description: 'Channel required.', color: client.color.red});
                        await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { greeterChannelId: channel.id } });
                        return ctx.replyV2({ description: `Greeter channel set to ${channel}.`, color: client.color.main });
                    }
                    if (action === 'message') {
                        const msg = ctx.options.getString('message');
                        if (!msg) return ctx.replyV2({description: 'Message required.', color: client.color.red});
                        await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { greeterMessage: msg } });
                        return ctx.replyV2({ description: `Greeter message updated to:\n\`\`\`${msg}\`\`\``, color: client.color.main });
                    }
                    if (action === 'time') {
                        const time = ctx.options.getInteger('seconds');
                        if (time === null) return ctx.replyV2({description: 'Seconds required.', color: client.color.red});
                        await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { greeterTime: time } });
                        return ctx.replyV2({ description: time === 0 ? 'Greeter messages will not auto-delete.' : `Greeter messages delete after ${time}s.`, color: client.color.main });
                    }
                    break;
                }
                case 'joindm': {
                    const message = ctx.options.getString('message', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { joinDmMessage: message }, create: { id: ctx.guild.id, joinDmMessage: message } });
                    return ctx.replyV2({ title: 'Join DM Configured', description: `Preview:\n${message.replace(/{user}/g, ctx.author.toString()).replace(/{server}/g, ctx.guild.name)}`, color: client.color.main });
                }
                case 'starboard': {
                    const channel = ctx.options.getChannel('channel', true);
                    const count = ctx.options.getInteger('count', true);
                    if (count < 1) return ctx.replyV2({ description: 'Count must be at least 1.', color: client.color.red, isAlert: true });
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { starboardChannelId: channel.id, starboardCount: count }, create: { id: ctx.guild.id, starboardChannelId: channel.id, starboardCount: count } });
                    return ctx.replyV2({ title: 'Starboard Configured', description: `Channel: ${channel}\nRequired Stars: ${count}`, color: client.color.main });
                }
                case 'birthday': {
                    const channel = ctx.options.getChannel('channel', true);
                    const role = ctx.options.getRole('ping_role');
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { birthdayChannelId: channel.id, birthdayPingRoleId: role?.id || null }, create: { id: ctx.guild.id, birthdayChannelId: channel.id, birthdayPingRoleId: role?.id || null } });
                    return ctx.replyV2({ title: 'Birthday Configured', description: `Birthdays will be announced in ${channel}${role ? ` pinging ${role}` : ''}.`, color: client.color.main });
                }
                case 'confess': {
                    const channel = ctx.options.getChannel('channel', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { confessionChannel: channel.id }, create: { id: ctx.guild.id, confessionChannel: channel.id } });
                    await (channel as TextChannel).send(V2Helper.createLayout({
                        title: ' Anonymous Confessions',
                        description: 'Share your deepest secrets anonymously! Click the button below to send a confession.',
                        color: client.color.main,
                        footer: 'Your identity will remain completely hidden.',
                        buttons: [ new ButtonBuilder().setCustomId('confess_create').setLabel('Send Confession').setEmoji('1494693086843109527').setStyle(ButtonStyle.Primary) ]
                    }) as any).catch(() => {});
                    return ctx.replyV2({ title: 'Confession Configured', description: `Anonymous confessions posted in ${channel}.`, color: client.color.main });
                }
                case 'counting': {
                    const channel = ctx.options.getChannel('channel', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { countingChannel: channel.id, countingCurrent: 0, countingLastUser: null }, create: { id: ctx.guild.id, countingChannel: channel.id, countingCurrent: 0 } });
                    return ctx.replyV2({ title: 'Counting Setup', description: `Counting game set to ${channel}.`, color: client.color.main });
                }
                case 'story': {
                    const channel = ctx.options.getChannel('channel', true);
                    await client.prisma.story.upsert({ where: { guildId_channelId: { guildId: ctx.guild.id, channelId: channel.id } }, update: { isActive: true }, create: { guildId: ctx.guild.id, channelId: channel.id, content: '' } });
                    return ctx.replyV2({ title: 'Story Setup', description: `Collaborative story game set to ${channel}.`, color: client.color.main });
                }
                case 'suggestion': {
                    const channel = ctx.options.getChannel('channel', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { suggestionChannelId: channel.id }, create: { id: ctx.guild.id, suggestionChannelId: channel.id } });
                    return ctx.replyV2({ title: 'Suggestions Configured', description: `Suggestions posted in ${channel}.`, color: client.color.main });
                }
                case 'vanity': {
                    const slug = ctx.options.getString('slug', true);
                    const role = ctx.options.getRole('role', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { vanityString: slug, vanityRoleId: role.id }, create: { id: ctx.guild.id, vanityString: slug, vanityRoleId: role.id } });
                    return ctx.replyV2({ title: 'Vanity Setup Complete', description: `Slug: \`${slug}\`\nRole: ${role}`, color: client.color.main });
                }
                case 'verify': {
                    const channel = ctx.options.getChannel('channel', true);
                    const role = ctx.options.getRole('role', true);
                    await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { verificationChannelId: channel.id, verificationRoleId: role.id }, create: { id: ctx.guild.id, verificationChannelId: channel.id, verificationRoleId: role.id } });
                    await (channel as TextChannel).send(V2Helper.createLayout({
                        title: ' Verification Gate',
                        description: `Welcome to **${ctx.guild.name}**!\n\nPlease click the button below to verify yourself.`,
                        color: client.color.main,
                        footer: 'Powered by Enc Security',
                        buttons: [ new ButtonBuilder().setCustomId('verify_button').setLabel('Verify').setEmoji(client.emoji.success).setStyle(ButtonStyle.Secondary) ]
                    }) as any).catch(()=>{});
                    return ctx.replyV2({ title: 'Verification Configured', description: `System set in ${channel} with ${role} role.`, color: client.color.main });
                }
                case 'autorole': {
                    const action = ctx.options.getString('action', true);
                    if (action === 'add') {
                        const role = ctx.options.getRole('role');
                        if (!role) return ctx.replyV2({description: 'Role required for add.', color: client.color.red});
                        await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { autoroleId: role.id }, create: { id: ctx.guild.id, autoroleId: role.id } });
                        return ctx.replyV2({ title: 'Autorole Enabled', description: `New members receive ${role}.`, color: client.color.main });
                    } else {
                        await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { autoroleId: null } });
                        return ctx.replyV2({ title: 'Autorole Disabled', description: 'Autorole disabled.', color: client.color.main });
                    }
                }
                case 'music': {
                    return ctx.replyV2({ title: 'Music Setup Redirect', description: 'Use the setup dashboard to manage music and all other modules!', isAlert: true });
                }
                case 'level': {
                    const action = ctx.options.getString('action', true);
                    if (action === 'channel') {
                        const target = ctx.options.getChannel('target');
                        if (!target) return ctx.replyV2({description: 'Target channel required.', color: client.color.red});
                        await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { levelUpChannelId: target.id }, create: { id: ctx.guild.id, levelUpChannelId: target.id } });
                        return ctx.replyV2({ description: `Level-up notifications sent in ${target}.`, color: client.color.main });
                    } else if (action === 'card-channel') {
                        const target = ctx.options.getChannel('target');
                        if (!target) return ctx.replyV2({description: 'Target channel required.', color: client.color.red});
                        await client.prisma.guild.upsert({ where: { id: ctx.guild.id }, update: { rankCardChannelId: target.id }, create: { id: ctx.guild.id, rankCardChannelId: target.id } });
                        return ctx.replyV2({ description: `Rank cards sent in ${target}.`, color: client.color.main });
                    } else if (action === 'booster-add') {
                        const role = ctx.options.getRole('role');
                        const pct = ctx.options.getInteger('percentage');
                        if (!role || !pct) return ctx.replyV2({description: 'Role and percentage required.', color: client.color.red});
                        await client.prisma.roleBooster.upsert({ where: { guildId_roleId: { guildId: ctx.guild.id, roleId: role.id } }, update: { percentage: pct }, create: { guildId: ctx.guild.id, roleId: role.id, percentage: pct } });
                        return ctx.replyV2({ description: `Added **${pct}%** XP boost to ${role}.`, color: client.color.main });
                    } else if (action === 'booster-remove') {
                        const role = ctx.options.getRole('role');
                        if (!role) return ctx.replyV2({description: 'Role required.', color: client.color.red});
                        await client.prisma.roleBooster.delete({ where: { guildId_roleId: { guildId: ctx.guild.id, roleId: role.id } } }).catch(()=>{});
                        return ctx.replyV2({ description: `Removed XP boost from ${role}.`, color: client.color.main });
                    } else if (action === 'booster-list') {
                        const boosters = await client.prisma.roleBooster.findMany({ where: { guildId: ctx.guild.id } });
                        if (!boosters.length) return ctx.replyV2({ description: 'No XP booster roles configured.', isAlert: true });
                        return ctx.replyV2({ title: 'XP Booster Roles', description: boosters.map(b => `<@&${b.roleId}>: **+${b.percentage}%** XP`).join('\n'), color: client.color.main });
                    }
                    break;
                }
            }
        }
    }

    private getDashboardLayout() {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("setup_category")
            .setPlaceholder("Select a category to configure...")
            .addOptions([
                { label: "General Settings", description: "Prefix, Welcomer, and Basic Info", value: "setup_general", emoji: "⚙️" },
                { label: "Moderation & Safety", description: "Auto-Mod, Anti-Nuke, and Logging", value: "setup_mod", emoji: "🛡️" },
                { label: "Social & Expressions", description: "Reactions, Counting, and Story", value: "setup_social", emoji: "🎭" },
                { label: "Utility & Engagement", description: "Starboard, Suggestions, and Leveling", value: "setup_utility", emoji: "🛠️" },
                { label: "Music & Multimedia", description: "Song Requests and Player Config", value: "setup_music", emoji: "🎵" }
            ]);

        return {
            title: "Server Setup Dashboard",
            description: "Welcome to the **Enc Control Panel**.\nUse the menu below to configure each module.",
            color: this.client.color.main,
            selectMenu: menu
        };
    }

    private async handleLog(client: ExtendedClient, ctx: Context, sub: string): Promise<any> {
        if (sub === 'status') {
            const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } }) as any;
            const logMode = guildData.logMode || 'CORE';
            return ctx.replyV2({
                title: `${client.emoji.info} Logging Configuration`,
                color: client.color.main,
                fields: [
                    { name: 'Mode', value: `\`${logMode}\``, inline: true },
                    { name: 'Core Channel', value: guildData.logChannelId ? `<#${guildData.logChannelId}>` : '\`Not Set\`', inline: true },
                    { name: 'Category', value: guildData.logCategoryId ? `<#${guildData.logCategoryId}>` : '\`Not Set\`', inline: true }
                ]
            });
        } else if (sub === 'setup') {
            const mode = ctx.options.getString('mode', true);
            const targetChannel = ctx.options.getChannel('target');
            
            if (mode === 'core') {
                if (!targetChannel || targetChannel.type !== ChannelType.GuildText) return ctx.replyV2({ description: 'Please specify a **text channel** for core logging.', color: client.color.red });
                await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { logChannelId: targetChannel.id, logMode: 'CORE' } });
                return ctx.replyV2({ description: `Core Logging Enabled in ${targetChannel}.`, color: client.color.main });
            } else if (mode === 'category') {
                let category: CategoryChannel;
                if (targetChannel && targetChannel.type === ChannelType.GuildCategory) {
                    category = targetChannel as any;
                } else {
                    category = await ctx.guild.channels.create({ name: '📋 Logs', type: ChannelType.GuildCategory, permissionOverwrites: [{ id: ctx.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }] });
                }
                await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { logMode: 'CATEGORY', logCategoryId: category.id } });
                return ctx.replyV2({ description: `Category Logging Enabled under ${category}. Log events will auto-generate channels as needed.`, color: client.color.main });
            } else if (mode === 'status') {
                return this.handleLog(client, ctx, 'status');
            } else if (mode === 'disable') {
                await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: { logChannelId: null, logMode: 'CORE' } });
                return ctx.replyV2({ description: 'Logging disabled.', color: client.color.red });
            }
        } else if (sub === 'config') {
            const category = ctx.options.getString('category', true);
            const toggle = ctx.options.getBoolean('toggle');
            const channel = ctx.options.getChannel('channel');
            
            if (toggle === null && !channel) return ctx.replyV2({ description: 'Must provide toggle or channel to update.', color: client.color.red });
            
            const dbFields: any = {};
            if (toggle !== null) dbFields[`log${category}Enabled`] = toggle;
            if (channel) dbFields[`logChannel${category}`] = channel.id;
            
            await client.prisma.guild.update({ where: { id: ctx.guild.id }, data: dbFields });
            return ctx.replyV2({ description: `Updated **${category}** logging.`, color: client.color.main });
        }
    }

    private async handleStreaktier(client: ExtendedClient, ctx: Context, sub: string) {
        if (sub === 'add') {
            const name = ctx.options.getString('name', true);
            const threshold = ctx.options.getInteger('threshold', true);
            const existing = await client.prisma.streakTier.findUnique({ where: { guildId_threshold: { guildId: ctx.guild.id, threshold } } });
            if (existing) return ctx.replyV2({ description: `Tier with threshold ${threshold} already exists.`, color: client.color.red });
            await client.prisma.streakTier.create({ data: { guildId: ctx.guild.id, name, threshold } });
            return ctx.replyV2({ description: `Created **${name}** tier (${threshold} msgs/day).`, color: client.color.main });
        } else if (sub === 'remove') {
            const threshold = ctx.options.getInteger('threshold', true);
            const existing = await client.prisma.streakTier.findUnique({ where: { guildId_threshold: { guildId: ctx.guild.id, threshold } } });
            if (!existing) return ctx.replyV2({ description: `No tier found with threshold ${threshold}.`, color: client.color.red });
            await client.prisma.streakTier.delete({ where: { id: existing.id } });
            return ctx.replyV2({ description: `Removed **${existing.name}** tier.`, color: client.color.main });
        } else if (sub === 'list') {
            const tiers = await client.prisma.streakTier.findMany({ where: { guildId: ctx.guild.id }, orderBy: { threshold: 'asc' } });
            if (!tiers.length) return ctx.replyV2({ description: 'No streak tiers configured.', color: client.color.red });
            return ctx.replyV2({ title: '🔥 Streak Tiers', description: tiers.map(t => `**${t.name}** - ${t.threshold} msg/day`).join('\n'), color: client.color.main });
        }
    }

    private async handleRoleconnect(client: ExtendedClient, ctx: Context, sub: string) {
        if (sub === 'add') {
            const trigger = ctx.options.getRole('trigger', true);
            const target = ctx.options.getRole('target', true);
            if (trigger.id === target.id) return ctx.replyV2({ description: 'Trigger and target cannot be the same.', color: client.color.red });
            await client.prisma.roleConnection.upsert({ where: { guildId_triggerRoleId_connectedRoleId: { guildId: ctx.guild.id, triggerRoleId: trigger.id, connectedRoleId: target.id } }, update: {}, create: { guildId: ctx.guild.id, triggerRoleId: trigger.id, connectedRoleId: target.id } });
            return ctx.replyV2({ description: `Linked ${trigger} to ${target}.`, color: client.color.main });
        } else if (sub === 'remove') {
            const trigger = ctx.options.getRole('trigger', true);
            const target = ctx.options.getRole('target', true);
            await client.prisma.roleConnection.deleteMany({ where: { guildId: ctx.guild.id, triggerRoleId: trigger.id, connectedRoleId: target.id } });
            return ctx.replyV2({ description: `Unlinked ${trigger} and ${target}.`, color: client.color.main });
        } else if (sub === 'list') {
            const connections = await client.prisma.roleConnection.findMany({ where: { guildId: ctx.guild.id } });
            if (!connections.length) return ctx.replyV2({ description: 'No role connections found.', color: client.color.red });
            const grouped = connections.reduce((acc, conn) => {
                if (!acc[conn.triggerRoleId]) acc[conn.triggerRoleId] = [];
                acc[conn.triggerRoleId].push(conn.connectedRoleId);
                return acc;
            }, {} as Record<string, string[]>);
            const lines = Object.entries(grouped).map(([tId, cIds]) => {
                return `**<@&${tId}>**\n${cIds.map(id => `\u2514 <@&${id}>`).join('\n')}`;
            }).join('\n\n');
            return ctx.replyV2({ title: 'Role Connections', description: lines, color: client.color.main });
        }
    }

    private async handleAutoresponder(client: ExtendedClient, ctx: Context, sub: string) {
        if (sub === 'add') {
            const trigger = ctx.options.getString('trigger', true).toLowerCase();
            const response = ctx.options.getString('response', true);
            const existing = await client.prisma.autoResponse.findFirst({ where: { guildId: ctx.guild.id, trigger } });
            if (existing) {
                await client.prisma.autoResponse.update({ where: { id: existing.id }, data: { response } });
            } else {
                await client.prisma.autoResponse.create({ data: { guildId: ctx.guild.id, trigger, response } });
            }
            return ctx.replyV2({ description: `Auto-response for \`${trigger}\` set up.`, color: client.color.main });
        } else if (sub === 'delete') {
            const trigger = ctx.options.getString('trigger', true).toLowerCase();
            const deleted = await client.prisma.autoResponse.deleteMany({ where: { guildId: ctx.guild.id, trigger } });
            if (deleted.count === 0) return ctx.replyV2({ description: `No auto-response found for \`${trigger}\`.`, color: client.color.red });
            return ctx.replyV2({ description: `Deleted auto-response for \`${trigger}\`.`, color: client.color.main });
        } else if (sub === 'list') {
            const responders = await client.prisma.autoResponse.findMany({ where: { guildId: ctx.guild.id } });
            if (!responders.length) return ctx.replyV2({ description: 'No auto-responses configured.', color: client.color.red });
            const list = responders.map(r => ` \`${r.trigger}\`  ${r.response}`).join('\n');
            return ctx.replyV2({ title: 'Auto-Responses', description: list.slice(0, 4000), color: client.color.main });
        }
    }
}
