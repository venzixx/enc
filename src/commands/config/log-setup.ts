import { PermissionFlagsBits, ChannelType, EmbedBuilder, TextChannel, CategoryChannel } from "discord.js";
import { ExtendedClient } from "../../client";
import { Command, Context } from "../../structures";

export default class LogSetup extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'log-setup',
            aliases: ['logsetup', 'logging-setup'],
            description: {
                content: 'Configure the logging system mode and core channel.',
                usage: 'log-setup <mode> [channel/category]',
                examples: ['log-setup core #logs', 'log-setup category Logs', 'log-setup status']
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels]
            },
            options: [
                {
                    name: 'mode',
                    description: 'Logging mode to set',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Core — Single channel for all logs', value: 'core' },
                        { name: 'Category — Separate channels per log type', value: 'category' },
                        { name: 'Status — Show current configuration', value: 'status' },
                        { name: 'Disable — Turn off all logging', value: 'disable' },
                    ]
                },
                {
                    name: 'target',
                    description: 'The target channel (for core mode) or category (for category mode)',
                    type: 7, // CHANNEL
                    required: false,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const mode = ctx.isInteraction
            ? ctx.options.getString('mode')
            : args[0]?.toLowerCase();

        const targetChannel = ctx.isInteraction
            ? ctx.options.getChannel('target')
            : null;

        const guild = ctx.guild!;
        const guildData = await client.prisma.guild.findUnique({ where: { id: guild.id } });
        if (!guildData) return;

        // ─────────────────────────────────────────
        //  STATUS
        // ─────────────────────────────────────────
        if (mode === 'status') {
            const s = guildData as any;
            const logMode = s.logMode || 'CORE';
            const coreChannel = guildData.logChannelId ? `<#${guildData.logChannelId}>` : '`Not Set`';

            const categories = [
                { name: 'Messages', enabled: guildData.logMessagesEnabled, channel: guildData.logChannelMessages },
                { name: 'Channels', enabled: guildData.logChannelsEnabled, channel: guildData.logChannelChannels },
                { name: 'Roles', enabled: guildData.logRolesEnabled, channel: guildData.logChannelRoles },
                { name: 'Members', enabled: guildData.logMembersEnabled, channel: guildData.logChannelMembers },
                { name: 'Moderation', enabled: guildData.logModerationEnabled, channel: guildData.logChannelModeration },
                { name: 'Security', enabled: guildData.logSecurityEnabled, channel: guildData.logChannelSecurity },
                { name: 'Voice', enabled: guildData.logVoiceEnabled, channel: guildData.logChannelVoice },
                { name: 'Automod', enabled: s.logAutomodEnabled ?? true, channel: s.logChannelAutomod },
                { name: 'Bot', enabled: s.logBotEnabled ?? true, channel: s.logChannelBot },
                { name: 'Invites', enabled: s.logInvitesEnabled ?? true, channel: s.logChannelInvites },
                { name: 'Emoji', enabled: s.logEmojiEnabled ?? true, channel: s.logChannelEmoji },
                { name: 'Sticker', enabled: s.logStickerEnabled ?? true, channel: s.logChannelSticker },
                { name: 'Events', enabled: s.logEventsEnabled ?? true, channel: s.logChannelEvents },
                { name: 'Stage', enabled: s.logStageEnabled ?? true, channel: s.logChannelStage },
                { name: 'Server', enabled: s.logServerEnabled ?? true, channel: s.logChannelServer },
                { name: 'Threads', enabled: s.logThreadsEnabled ?? true, channel: s.logChannelThreads },
                { name: 'Vanity', enabled: s.logVanityEnabled ?? true, channel: s.logChannelVanity },
                { name: 'Webhooks', enabled: s.logWebhooksEnabled ?? true, channel: s.logChannelWebhooks },
            ];

            const lines = categories.map(c => {
                const status = c.enabled ? '🟢' : '🔴';
                const ch = logMode === 'CATEGORY' && c.channel ? ` → <#${c.channel}>` : '';
                return `${status} **${c.name}**${ch}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.info} Logging Configuration`)
                .addFields(
                    { name: 'Mode', value: `\`${logMode}\``, inline: true },
                    { name: 'Core Channel', value: coreChannel, inline: true },
                    { name: 'Category', value: s.logCategoryId ? `<#${s.logCategoryId}>` : '`Not Set`', inline: true },
                    { name: 'Categories', value: lines.join('\n') }
                )
                .setColor(client.color.main)
                .setTimestamp();

            return ctx.editReply({ embeds: [embed] });
        }

        // ─────────────────────────────────────────
        //  CORE MODE
        // ─────────────────────────────────────────
        if (mode === 'core') {
            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
                return ctx.sendV2({
                    title: `${client.emoji.cross} Invalid Target`,
                    description: 'Please specify a **text channel** for core logging mode.\nUsage: `/log-setup core #your-log-channel`',
                    isAlert: true,
                    color: client.color.red
                });
            }

            await client.prisma.guild.update({
                where: { id: guild.id },
                data: {
                    logChannelId: targetChannel.id,
                    logMode: 'CORE'
                } as any
            });

            return ctx.sendV2({
                title: `${client.emoji.check} Core Logging Enabled`,
                description: `All logs will now be sent to ${targetChannel}.\nToggle individual categories with \`/log toggle <category>\`.`,
                color: client.color.main
            });
        }

        // ─────────────────────────────────────────
        //  CATEGORY MODE
        // ─────────────────────────────────────────
        if (mode === 'category') {
            let category: CategoryChannel;

            if (targetChannel && targetChannel.type === ChannelType.GuildCategory) {
                category = targetChannel as unknown as CategoryChannel;
            } else {
                // Create a new category
                try {
                    category = await guild.channels.create({
                        name: '📋 Logs',
                        type: ChannelType.GuildCategory,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: client.user!.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
                            }
                        ]
                    });
                } catch (e) {
                    return ctx.sendV2({
                        title: `${client.emoji.cross} Error`,
                        description: 'Failed to create the logging category. Make sure I have `Manage Channels` permission.',
                        isAlert: true,
                        color: client.color.red
                    });
                }
            }

            // Create channels for each enabled category inside the Discord category
            const channelMap: Record<string, string> = {};
            const logTypes = [
                'messages', 'channels', 'roles', 'members', 'moderation',
                'security', 'voice', 'automod', 'bot', 'invites',
                'emoji', 'sticker', 'events', 'stage', 'server',
                'threads', 'vanity', 'webhooks'
            ];

            for (const logType of logTypes) {
                const enabledKey = `log${logType.charAt(0).toUpperCase() + logType.slice(1)}Enabled`;
                const gd = guildData as any;
                const isEnabled = gd[enabledKey] ?? true;
                if (!isEnabled) continue;

                // Check if channel already exists in category
                const existing = category.children.cache.find(
                    c => c.name === `${logType}-logs` && c.type === ChannelType.GuildText
                );

                if (existing) {
                    channelMap[logType] = existing.id;
                } else {
                    try {
                        const newCh = await guild.channels.create({
                            name: `${logType}-logs`,
                            type: ChannelType.GuildText,
                            parent: category.id,
                        });
                        channelMap[logType] = newCh.id;
                    } catch (e) {
                        console.error(`Failed to create ${logType}-logs channel:`, e);
                    }
                }
            }

            // Build the update data
            const updateData: any = {
                logMode: 'CATEGORY',
                logCategoryId: category.id,
            };

            if (channelMap.messages) updateData.logChannelMessages = channelMap.messages;
            if (channelMap.channels) updateData.logChannelChannels = channelMap.channels;
            if (channelMap.roles) updateData.logChannelRoles = channelMap.roles;
            if (channelMap.members) updateData.logChannelMembers = channelMap.members;
            if (channelMap.moderation) updateData.logChannelModeration = channelMap.moderation;
            if (channelMap.security) updateData.logChannelSecurity = channelMap.security;
            if (channelMap.voice) updateData.logChannelVoice = channelMap.voice;
            if (channelMap.automod) updateData.logChannelAutomod = channelMap.automod;
            if (channelMap.bot) updateData.logChannelBot = channelMap.bot;
            if (channelMap.invites) updateData.logChannelInvites = channelMap.invites;
            if (channelMap.emoji) updateData.logChannelEmoji = channelMap.emoji;
            if (channelMap.sticker) updateData.logChannelSticker = channelMap.sticker;
            if (channelMap.events) updateData.logChannelEvents = channelMap.events;
            if (channelMap.stage) updateData.logChannelStage = channelMap.stage;
            if (channelMap.server) updateData.logChannelServer = channelMap.server;
            if (channelMap.threads) updateData.logChannelThreads = channelMap.threads;
            if (channelMap.vanity) updateData.logChannelVanity = channelMap.vanity;
            if (channelMap.webhooks) updateData.logChannelWebhooks = channelMap.webhooks;

            await client.prisma.guild.update({
                where: { id: guild.id },
                data: updateData
            });

            const createdCount = Object.keys(channelMap).length;
            return ctx.sendV2({
                title: `${client.emoji.check} Category Logging Enabled`,
                description: `Created **${createdCount}** log channels under ${category}.\nEach log type will be sent to its own channel.\nToggle individual categories with \`/log toggle <category>\`.`,
                color: client.color.main
            });
        }

        // ─────────────────────────────────────────
        //  DISABLE
        // ─────────────────────────────────────────
        if (mode === 'disable') {
            await client.prisma.guild.update({
                where: { id: guild.id },
                data: {
                    logChannelId: null,
                    logMode: 'CORE'
                } as any
            });

            return ctx.sendV2({
                title: `${client.emoji.check} Logging Disabled`,
                description: 'All logging has been disabled. No log events will be recorded to channels.',
                color: client.color.red
            });
        }
    }
}
