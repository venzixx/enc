import { 
    ApplicationCommandOptionType,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    TextChannel
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class Config extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'config',
            aliases: ['setup', 'conf', 'setting'],
            description: {
                content: 'Configure server modules and security systems.',
                usage: 'setup <category> <subcommand>',
                examples: ['setup core prefix', 'setup modules welcome', 'setup security automod']
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            options: [
                {
                    name: 'core',
                    description: 'Core server configuration.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'prefix',
                            description: 'Change the custom prefix for this server.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'new_prefix', description: 'The new prefix', type: ApplicationCommandOptionType.String, required: true }]
                        },
                        {
                            name: 'logs',
                            description: 'Configure the server audit logging channel.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [{ name: 'channel', description: 'Audit logs channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }]
                        }
                    ]
                },
                {
                    name: 'modules',
                    description: 'Toggle and configure functional modules.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'welcome',
                            description: 'Setup the welcome messages module.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'channel', description: 'Welcome channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                                { name: 'message', description: 'Welcome message (use {user} for mention)', type: ApplicationCommandOptionType.String, required: false }
                            ]
                        },
                        {
                            name: 'starboard',
                            description: 'Setup the starboard system.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'channel', description: 'Starboard channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true },
                                { name: 'threshold', description: 'Stars required', type: ApplicationCommandOptionType.Integer, required: false }
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
                            name: 'confession',
                            description: 'Setup the anonymous confession module.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'channel', description: 'Confession channel', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: true }
                            ]
                        }
                    ]
                },
                {
                    name: 'security',
                    description: 'Configure server security and anti-nuke.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'automod',
                            description: 'Initialize high-security automod rules.',
                            type: ApplicationCommandOptionType.Subcommand
                        },
                        {
                            name: 'antinuke',
                            description: 'Toggle global anti-nuke shield.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                { name: 'state', description: 'Protection state', type: ApplicationCommandOptionType.Boolean, required: true }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const group = ctx.options.getSubcommandGroup();
        const sub = ctx.options.getSubcommand();

        if (group === 'core') {
            if (sub === 'prefix') {
                const newPrefix = ctx.options.getString('new_prefix', true);
                if (newPrefix.length > 5) return ctx.replyV2({ description: 'Prefix cannot be longer than 5 characters.', isAlert: true });
                
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { prefix: newPrefix },
                    create: { id: ctx.guild.id, prefix: newPrefix }
                });
                return ctx.replyV2({ description: `Successfully updated server prefix to \`${newPrefix}\`.` });
            }
            if (sub === 'logs') {
                const channel = ctx.options.getChannel('channel', true);
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { logChannelId: channel.id },
                    create: { id: ctx.guild.id, logChannelId: channel.id }
                });
                return ctx.replyV2({ description: `Successfully set audit logging channel to ${channel}.` });
            }
        }

        if (group === 'modules') {
            if (sub === 'welcome') {
                const channel = ctx.options.getChannel('channel', true);
                const message = ctx.options.getString('message') || 'Welcome {user} to the server!';
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { welcomeChannelId: channel.id, welcomeMessage: message },
                    create: { id: ctx.guild.id, welcomeChannelId: channel.id, welcomeMessage: message }
                });
                return ctx.replyV2({ description: `Successfully configured welcome messages in ${channel}.` });
            }
            if (sub === 'starboard') {
                const channel = ctx.options.getChannel('channel', true);
                const threshold = ctx.options.getInteger('threshold') || 3;
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { starboardChannelId: channel.id, starboardCount: threshold },
                    create: { id: ctx.guild.id, starboardChannelId: channel.id, starboardCount: threshold }
                });
                return ctx.replyV2({ description: `Successfully configured starboard in ${channel} with threshold \`${threshold}\`.` });
            }
            if (sub === 'birthday') {
                const channel = ctx.options.getChannel('channel', true);
                const role = ctx.options.getRole('ping_role');
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { birthdayChannelId: channel.id, birthdayPingRoleId: role?.id || null },
                    create: { id: ctx.guild.id, birthdayChannelId: channel.id, birthdayPingRoleId: role?.id || null }
                });
                return ctx.replyV2({ description: `Successfully configured birthdays in ${channel}${role ? ` (Pinging ${role})` : ''}.` });
            }
            if (sub === 'confession') {
                const channel = ctx.options.getChannel('channel', true) as TextChannel;
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { confessionChannel: channel.id },
                    create: { id: ctx.guild.id, confessionChannel: channel.id }
                });

                // Send the starter message with the fixed emoji
                await channel.send(V2Helper.createLayout({
                    title: ' Anonymous Confessions',
                    description: 'Share your deepest secrets anonymously! Click the button below to send a confession.',
                    color: client.color.main,
                    footer: 'Your identity will remain completely hidden.',
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('confess_create')
                            .setLabel('Send Confession')
                            .setEmoji('1494693086843109527')
                            .setStyle(ButtonStyle.Primary)
                    ]
                }) as any).catch(() => {});

                return ctx.replyV2({ description: `Successfully configured anonymous confessions in ${channel}.` });
            }
        }

        if (group === 'security') {
            if (sub === 'automod') {
                return this.handleAutomod(client, ctx);
            }
            if (sub === 'antinuke') {
                const state = ctx.options.getBoolean('state', true);
                await client.prisma.guild.upsert({
                    where: { id: ctx.guild.id },
                    update: { antiNukeEnabled: state },
                    create: { id: ctx.guild.id, antiNukeEnabled: state }
                });
                return ctx.replyV2({ description: `${client.emoji.shield} Global Anti-Nuke state set to **${state ? 'Enabled' : 'Disabled'}**.` });
            }
        }

        return ctx.replyV2({ description: 'Specific setup logic coming soon.', color: client.color.yellow });
    }

    private async handleAutomod(client: ExtendedClient, ctx: Context) {
        try {
            const { AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationRuleKeywordPresetType, AutoModerationActionType } = require('discord.js');
            await ctx.guild.autoModerationRules.create({
                name: 'Enc Security Automod',
                creatorId: client.user?.id,
                enabled: true,
                eventType: AutoModerationRuleEventType.MessageSend,
                triggerType: AutoModerationRuleTriggerType.KeywordPreset,
                triggerMetadata: {
                    presets: [
                        AutoModerationRuleKeywordPresetType.Profanity,
                        AutoModerationRuleKeywordPresetType.SexualContent,
                        AutoModerationRuleKeywordPresetType.Slurs
                    ]
                },
                actions: [
                    {
                        type: AutoModerationActionType.BlockMessage,
                        metadata: { customMessage: 'This message was blocked by Enc Security Automod.' }
                    }
                ]
            });
            return ctx.replyV2({ title: 'Automod Active', description: 'Discord profanity and slur filters have been enabled.' });
        } catch (e: any) {
            return ctx.replyV2({ description: `Failed to setup AutoMod: ${e.message}`, isAlert: true });
        }
    }
}
