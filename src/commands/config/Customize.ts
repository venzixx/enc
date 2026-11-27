import {
    PermissionFlagsBits,
    ApplicationCommandOptionType,
    ChannelType,
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Customize extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'customize',
            aliases: ['custom', 'cardconfig', 'embedconfig'],
            description: {
                content: 'Customize welcome and booster card embeds (title, description, footer, color, background).',
                usage: 'customize <welcome|booster> <setting> <value>',
                examples: [
                    'customize welcome title Welcome to our server!',
                    'customize welcome description Hello {user}, enjoy your stay!',
                    'customize welcome footer {server} • Member #{server.member_count}',
                    'customize welcome color #ff69b4',
                    'customize welcome background https://i.imgur.com/example.png',
                    'customize welcome channel #welcome',
                    'customize welcome message Welcome {user} to {server}!',
                    'customize welcome reset',
                    'customize welcome view',
                    'customize booster title 🚀 {user} Boosted!',
                    'customize booster description Thank you {booster} for boosting!',
                    'customize booster footer {server} • Boost #{server.boost_count}',
                    'customize booster color #f47fff',
                    'customize booster background https://i.imgur.com/example.png',
                    'customize booster channel #boosts',
                    'customize booster message {booster} just boosted {server}!',
                    'customize booster reset',
                    'customize booster view',
                ]
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'welcome',
                    description: 'Customize the welcome card.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'title',
                            description: 'Set the welcome card title.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Title text (supports placeholders: {user}, {server})', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'description',
                            description: 'Set the welcome card description/message.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Description text (supports placeholders)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'footer',
                            description: 'Set the welcome card footer.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Footer text (supports placeholders)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'color',
                            description: 'Set the welcome card accent color.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Hex color (e.g. #ff69b4)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'background',
                            description: 'Set the welcome card banner image.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'url', description: 'Image URL for the banner', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'channel',
                            description: 'Set the welcome channel.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'target', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                        },
                        {
                            name: 'message',
                            description: 'Set the raw welcome message (used for custom embed/JSON).',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Message text or JSON embed', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'view',
                            description: 'View current welcome card settings.',
                            type: ApplicationCommandOptionType.Subcommand,
                        },
                        {
                            name: 'reset',
                            description: 'Reset all welcome card customizations to defaults.',
                            type: ApplicationCommandOptionType.Subcommand,
                        }
                    ]
                },
                {
                    name: 'booster',
                    description: 'Customize the booster card.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'title',
                            description: 'Set the booster card title.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Title text (supports placeholders: {user}, {booster}, {server})', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'description',
                            description: 'Set the booster card description/message.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Description text (supports placeholders)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'footer',
                            description: 'Set the booster card footer.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Footer text (supports placeholders)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'color',
                            description: 'Set the booster card accent color.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Hex color (e.g. #f47fff)', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'background',
                            description: 'Set the booster card banner image.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'url', description: 'Image URL for the banner', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'channel',
                            description: 'Set the booster notification channel.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'target', description: 'Channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                        },
                        {
                            name: 'message',
                            description: 'Set the raw booster message (used for custom embed/JSON).',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'value', description: 'Message text or JSON embed', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'view',
                            description: 'View current booster card settings.',
                            type: ApplicationCommandOptionType.Subcommand,
                        },
                        {
                            name: 'reset',
                            description: 'Reset all booster card customizations to defaults.',
                            type: ApplicationCommandOptionType.Subcommand,
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const group = ctx.options.getSubcommandGroup(false) || args[0]?.toLowerCase();
        const sub = ctx.options.getSubcommand(false) || args[1]?.toLowerCase();

        if (!group || !['welcome', 'booster'].includes(group)) {
            return ctx.replyV2({
                title: '🎨 Card Customization',
                description: [
                    '**Welcome Card**',
                    '`customize welcome title <text>` — Set title',
                    '`customize welcome description <text>` — Set description',
                    '`customize welcome footer <text>` — Set footer',
                    '`customize welcome color <hex>` — Set accent color',
                    '`customize welcome background <url>` — Set banner image',
                    '`customize welcome channel <#channel>` — Set channel',
                    '`customize welcome message <text>` — Set raw message',
                    '`customize welcome view` — View current settings',
                    '`customize welcome reset` — Reset to defaults',
                    '',
                    '**Booster Card**',
                    '`customize booster title <text>` — Set title',
                    '`customize booster description <text>` — Set description',
                    '`customize booster footer <text>` — Set footer',
                    '`customize booster color <hex>` — Set accent color',
                    '`customize booster background <url>` — Set banner image',
                    '`customize booster channel <#channel>` — Set channel',
                    '`customize booster message <text>` — Set raw message',
                    '`customize booster view` — View current settings',
                    '`customize booster reset` — Reset to defaults',
                    '',
                    '-# **Placeholders:** `{user}` `{user.name}` `{user.mention}` `{server}` `{server.member_count}` `{server.boost_count}` `{server.boost_tier}` `{booster}` `{inviter}`'
                ].join('\n'),
                color: client.color.main
            });
        }

        if (group === 'welcome') {
            return this.handleWelcome(client, ctx, sub, args);
        } else if (group === 'booster') {
            return this.handleBooster(client, ctx, sub, args);
        }
    }

    private async handleWelcome(client: ExtendedClient, ctx: Context, sub: string, args: string[]): Promise<any> {
        const getValue = () => {
            if (ctx.isInteraction) {
                return ctx.options.getString('value') || ctx.options.getString('url') || null;
            }
            return args.slice(2).join(' ').trim() || null;
        };

        const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });

        switch (sub) {
            case 'title': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a title.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeCardTitle: value },
                    create: { id: ctx.guild.id, welcomeCardTitle: value }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Title Updated',
                    description: `New title: **${value}**`,
                    color: client.color.main,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'description':
            case 'desc': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a description.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeMessage: value },
                    create: { id: ctx.guild.id, welcomeMessage: value }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Description Updated',
                    description: `New description:\n${value}`,
                    color: client.color.main,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'footer': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide footer text.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeCardFooter: value },
                    create: { id: ctx.guild.id, welcomeCardFooter: value }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Footer Updated',
                    description: `New footer: \`${value}\``,
                    color: client.color.main,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'color':
            case 'colour': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a hex color (e.g. `#ff69b4`).', color: client.color.red, isAlert: true });
                const hex = value.startsWith('#') ? value : `#${value}`;
                if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    return ctx.replyV2({ description: `\`${hex}\` is not a valid hex color. Use format \`#RRGGBB\`.`, color: client.color.red, isAlert: true });
                }
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeCardColor: hex },
                    create: { id: ctx.guild.id, welcomeCardColor: hex }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Color Updated',
                    description: `New accent color: \`${hex}\``,
                    color: hex as any,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'background':
            case 'bg':
            case 'banner':
            case 'image': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide an image URL.', color: client.color.red, isAlert: true });
                if (!value.startsWith('http')) {
                    return ctx.replyV2({ description: 'Please provide a valid URL starting with `http`.', color: client.color.red, isAlert: true });
                }
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeCardBackground: value },
                    create: { id: ctx.guild.id, welcomeCardBackground: value }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Background Updated',
                    description: `New banner: [View Image](${value})`,
                    image: value,
                    color: client.color.main,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'channel': {
                const channel = ctx.isInteraction
                    ? ctx.options.getChannel('target')
                    : ctx.message?.mentions?.channels?.first() || (args[2] ? ctx.guild.channels.cache.get(args[2].replace(/[<#>]/g, '')) : null);
                if (!channel) return ctx.replyV2({ description: 'Please mention a channel.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeChannelId: channel.id, welcomeEnabled: true },
                    create: { id: ctx.guild.id, welcomeChannelId: channel.id, welcomeEnabled: true }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Channel Updated',
                    description: `Welcome messages will be sent to <#${channel.id}>.`,
                    color: client.color.main
                });
            }
            case 'message':
            case 'msg': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a message.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeMessage: value },
                    create: { id: ctx.guild.id, welcomeMessage: value }
                });
                return ctx.replyV2({
                    title: '✅ Welcome Message Updated',
                    description: `\`\`\`${value.slice(0, 1500)}\`\`\``,
                    color: client.color.main,
                    footer: 'Use ,test welcome to preview'
                });
            }
            case 'view':
            case 'show':
            case 'settings':
            case 'status': {
                const title = guildData?.welcomeCardTitle || '*Default*';
                const desc = guildData?.welcomeMessage || '*Default*';
                const footer = (guildData as any)?.welcomeCardFooter || '*Default*';
                const color = guildData?.welcomeCardColor || '#38bdf8';
                const bg = guildData?.welcomeCardBackground || '*None (default image)*';
                const channel = guildData?.welcomeChannelId ? `<#${guildData.welcomeChannelId}>` : '*Not set*';
                const enabled = (guildData as any)?.welcomeEnabled ?? !!guildData?.welcomeChannelId;

                return ctx.replyV2({
                    title: '👋 Welcome Card Settings',
                    description: [
                        `**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
                        `**Channel:** ${channel}`,
                        `**Title:** ${title}`,
                        `**Description:** ${desc.length > 100 ? desc.slice(0, 100) + '...' : desc}`,
                        `**Footer:** ${footer}`,
                        `**Color:** \`${color}\``,
                        `**Background:** ${bg.startsWith('http') ? `[View](${bg})` : bg}`,
                    ].join('\n'),
                    color: color as any,
                    footer: 'Use ,test welcome to preview • ,customize welcome reset to reset'
                });
            }
            case 'reset': {
                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: {
                        welcomeCardTitle: null,
                        welcomeCardFooter: null,
                        welcomeCardColor: '#38bdf8',
                        welcomeCardBackground: null,
                        welcomeMessage: null,
                    }
                }).catch(() => {});
                return ctx.replyV2({
                    title: '🔄 Welcome Card Reset',
                    description: 'All welcome card customizations have been reset to defaults.',
                    color: client.color.main
                });
            }
            default: {
                return ctx.replyV2({
                    description: `Unknown setting \`${sub}\`. Available: \`title\`, \`description\`, \`footer\`, \`color\`, \`background\`, \`channel\`, \`message\`, \`view\`, \`reset\``,
                    color: client.color.red,
                    isAlert: true
                });
            }
        }
    }

    private async handleBooster(client: ExtendedClient, ctx: Context, sub: string, args: string[]): Promise<any> {
        const getValue = () => {
            if (ctx.isInteraction) {
                return ctx.options.getString('value') || ctx.options.getString('url') || null;
            }
            return args.slice(2).join(' ').trim() || null;
        };

        const guildData = await client.prisma.guild.findUnique({ where: { id: ctx.guild.id } });

        switch (sub) {
            case 'title': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a title.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterCardTitle: value },
                    create: { id: ctx.guild.id, boosterCardTitle: value }
                });
                return ctx.replyV2({
                    title: '✅ Booster Title Updated',
                    description: `New title: **${value}**`,
                    color: client.color.main,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'description':
            case 'desc': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a description.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterMessage: value },
                    create: { id: ctx.guild.id, boosterMessage: value }
                });
                return ctx.replyV2({
                    title: '✅ Booster Description Updated',
                    description: `New description:\n${value}`,
                    color: client.color.main,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'footer': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide footer text.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterCardFooter: value },
                    create: { id: ctx.guild.id, boosterCardFooter: value }
                });
                return ctx.replyV2({
                    title: '✅ Booster Footer Updated',
                    description: `New footer: \`${value}\``,
                    color: client.color.main,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'color':
            case 'colour': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a hex color (e.g. `#f47fff`).', color: client.color.red, isAlert: true });
                const hex = value.startsWith('#') ? value : `#${value}`;
                if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    return ctx.replyV2({ description: `\`${hex}\` is not a valid hex color. Use format \`#RRGGBB\`.`, color: client.color.red, isAlert: true });
                }
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterCardColor: hex },
                    create: { id: ctx.guild.id, boosterCardColor: hex }
                });
                return ctx.replyV2({
                    title: '✅ Booster Color Updated',
                    description: `New accent color: \`${hex}\``,
                    color: hex as any,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'background':
            case 'bg':
            case 'banner':
            case 'image': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide an image URL.', color: client.color.red, isAlert: true });
                if (!value.startsWith('http')) {
                    return ctx.replyV2({ description: 'Please provide a valid URL starting with `http`.', color: client.color.red, isAlert: true });
                }
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterCardBackground: value },
                    create: { id: ctx.guild.id, boosterCardBackground: value }
                });
                return ctx.replyV2({
                    title: '✅ Booster Background Updated',
                    description: `New banner: [View Image](${value})`,
                    image: value,
                    color: client.color.main,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'channel': {
                const channel = ctx.isInteraction
                    ? ctx.options.getChannel('target')
                    : ctx.message?.mentions?.channels?.first() || (args[2] ? ctx.guild.channels.cache.get(args[2].replace(/[<#>]/g, '')) : null);
                if (!channel) return ctx.replyV2({ description: 'Please mention a channel.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterChannelId: channel.id, boosterEnabled: true },
                    create: { id: ctx.guild.id, boosterChannelId: channel.id, boosterEnabled: true }
                });
                return ctx.replyV2({
                    title: '✅ Booster Channel Updated',
                    description: `Booster notifications will be sent to <#${channel.id}>.`,
                    color: client.color.main
                });
            }
            case 'message':
            case 'msg': {
                const value = getValue();
                if (!value) return ctx.replyV2({ description: 'Please provide a message.', color: client.color.red, isAlert: true });
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { boosterMessage: value },
                    create: { id: ctx.guild.id, boosterMessage: value }
                });
                return ctx.replyV2({
                    title: '✅ Booster Message Updated',
                    description: `\`\`\`${value.slice(0, 1500)}\`\`\``,
                    color: client.color.main,
                    footer: 'Use ,test booster to preview'
                });
            }
            case 'view':
            case 'show':
            case 'settings':
            case 'status': {
                const title = (guildData as any)?.boosterCardTitle || '*Default*';
                const desc = (guildData as any)?.boosterMessage || '*Default*';
                const footer = (guildData as any)?.boosterCardFooter || '*Default*';
                const color = (guildData as any)?.boosterCardColor || '#f47fff';
                const bg = (guildData as any)?.boosterCardBackground || '*None*';
                const channel = guildData?.boosterChannelId ? `<#${guildData.boosterChannelId}>` : '*Not set*';
                const enabled = (guildData as any)?.boosterEnabled ?? !!guildData?.boosterChannelId;

                return ctx.replyV2({
                    title: '🚀 Booster Card Settings',
                    description: [
                        `**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
                        `**Channel:** ${channel}`,
                        `**Title:** ${title}`,
                        `**Description:** ${desc.length > 100 ? desc.slice(0, 100) + '...' : desc}`,
                        `**Footer:** ${footer}`,
                        `**Color:** \`${color}\``,
                        `**Background:** ${bg.startsWith('http') ? `[View](${bg})` : bg}`,
                    ].join('\n'),
                    color: color as any,
                    footer: 'Use ,test booster to preview • ,customize booster reset to reset'
                });
            }
            case 'reset': {
                await client.prisma.guild.update({
                    where: { id: ctx.guild.id },
                    data: {
                        boosterCardTitle: null,
                        boosterCardFooter: null,
                        boosterCardColor: '#f47fff',
                        boosterCardBackground: null,
                        boosterMessage: null,
                    }
                }).catch(() => {});
                return ctx.replyV2({
                    title: '🔄 Booster Card Reset',
                    description: 'All booster card customizations have been reset to defaults.',
                    color: client.color.main
                });
            }
            default: {
                return ctx.replyV2({
                    description: `Unknown setting \`${sub}\`. Available: \`title\`, \`description\`, \`footer\`, \`color\`, \`background\`, \`channel\`, \`message\`, \`view\`, \`reset\``,
                    color: client.color.red,
                    isAlert: true
                });
            }
        }
    }
}
