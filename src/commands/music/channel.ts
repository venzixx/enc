import {
    ApplicationCommandOptionType,
    ChannelType,
    PermissionFlagsBits,
    TextChannel
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { getV2SetupLayout } from '../../utils/SetupSystem';

export default class ChannelCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'musicchannel',
            aliases: ['songrequest', 'songchannel', 'music-channel', 'requestchannel'],
            description: {
                content: 'Set up or manage the dedicated song request music channel.',
                usage: 'music channel [set #channel|create|delete|prefix <prefix|remove>|info]',
                examples: [
                    'music channel set #music',
                    'music channel set',
                    'music channel create',
                    'music channel prefix -',
                    'music channel prefix remove',
                    'music channel delete',
                    'music channel info'
                ]
            },
            category: 'music',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ]
            },
            options: [
                {
                    name: 'action',
                    description: 'Action to perform (set, create, delete, info)',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'Set', value: 'set' },
                        { name: 'Create', value: 'create' },
                        { name: 'Delete', value: 'delete' },
                        { name: 'Info', value: 'info' },
                        { name: 'Prefix', value: 'prefix' }
                    ]
                },
                {
                    name: 'channel',
                    description: 'The text channel to set for song requests (used with set)',
                    type: ApplicationCommandOptionType.Channel,
                    required: false
                },
                {
                    name: 'prefix',
                    description: 'The trigger prefix required for song requests (or "remove" to clear)',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        if (!ctx.guild) return;

        let action = ctx.isInteraction ? ctx.options.getString('action') : null;

        if (!action && args.length > 0) {
            const firstArg = args[0].toLowerCase();
            if (firstArg === 'set' || firstArg === 'bind') {
                action = 'set';
            } else if (firstArg === 'create' || firstArg === 'setup') {
                action = 'create';
            } else if (firstArg === 'delete' || firstArg === 'remove' || firstArg === 'unset' || firstArg === 'reset') {
                action = 'delete';
            } else if (firstArg === 'info' || firstArg === 'status') {
                action = 'info';
            } else if (firstArg === 'prefix') {
                action = 'prefix';
            } else if (firstArg.startsWith('<#') || /^\d{17,20}$/.test(firstArg) || ctx.guild.channels.cache.some((c: any) => c.name.toLowerCase() === firstArg.replace(/^#/, ''))) {
                action = 'set';
            }
        }

        const data = await client.db.getSetup(ctx.guild.id);
        const existingChannel = data?.textId ? (ctx.guild.channels.cache.get(data.textId) as TextChannel) : null;

        if (!action) {
            if (existingChannel) {
                action = 'info';
            } else {
                return ctx.replyV2({
                    title: '🎵 Song Request Channel Setup',
                    description:
                        'No song request channel is currently configured for this server.\n\n' +
                        '**Available Commands:**\n' +
                        '• `,music channel set #channel` — Set an existing channel as the song request channel\n' +
                        '• `,music channel set` — Set the current channel as the song request channel\n' +
                        '• `,music channel create` — Automatically create a new `#enc-song-requests` channel\n' +
                        '• `,music channel prefix <prefix|remove>` — Require a prefix for songs (e.g. `-`)\n' +
                        '• `,music channel delete` — Remove and unbind the music channel\n' +
                        '• `,music channel info` — View current channel status',
                    borderless: true,
                    color: null
                });
            }
        }

        // Action: SET
        if (action === 'set') {
            let targetChannel: TextChannel | null = null;

            // 1. Slash command interaction channel option
            if (ctx.isInteraction) {
                const ch = (ctx.interaction as any)?.options?.getChannel?.('channel') || (ctx.options as any)?.getChannel?.('channel', false);
                if (ch) targetChannel = ch as TextChannel;
            }

            // 2. Resolve from args
            if (!targetChannel) {
                const channelArg = args.find((a, idx) => {
                    if (idx === 0 && (a.toLowerCase() === 'set' || a.toLowerCase() === 'bind')) return false;
                    return true;
                });

                if (channelArg) {
                    const cleanedId = channelArg.replace(/[<#>]/g, '');
                    const found = ctx.guild.channels.cache.get(cleanedId) ||
                        ctx.guild.channels.cache.find((c: any) => c.name.toLowerCase() === channelArg.toLowerCase() || c.name.toLowerCase() === channelArg.replace(/^#/, '').toLowerCase());
                    if (found && found.type === ChannelType.GuildText) {
                        targetChannel = found as TextChannel;
                    }
                }
            }

            // 3. Fallback: current channel if text channel
            if (!targetChannel && ctx.channel && ctx.channel.type === ChannelType.GuildText) {
                targetChannel = ctx.channel as TextChannel;
            }

            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
                return ctx.replyV2({
                    title: '⚠️ Channel Not Found',
                    description:
                        'Please mention or provide a valid text channel to set!\n\n' +
                        '**Usage:**\n' +
                        '• `,music channel set #channel`\n' +
                        '• `,music channel set` *(sets current channel)*',
                    isAlert: true,
                    color: client.color.red
                });
            }

            // Check bot permissions in target channel
            const botMember = ctx.guild.members.me;
            if (botMember) {
                const botPerms = targetChannel.permissionsFor(botMember);
                if (!botPerms?.has([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ])) {
                    return ctx.replyV2({
                        title: '❌ Missing Bot Permissions',
                        description:
                            `I need the following permissions in ${targetChannel} to function properly:\n` +
                            `• **View Channel**\n• **Send Messages**\n• **Embed Links**\n• **Read Message History**\n• **Manage Messages**`,
                        isAlert: true,
                        color: client.color.red
                    });
                }
            }

            await ctx.deferReply();

            // Clean up old controller message if a previous setup channel exists
            if (data?.textId && data.messageId) {
                const oldChannel = ctx.guild.channels.cache.get(data.textId) as TextChannel;
                if (oldChannel) {
                    await oldChannel.messages.fetch(data.messageId).then(m => m.delete()).catch(() => null);
                }
            }

            const player = client.lavalink.getPlayer(ctx.guild.id);
            const locale = (await client.db.getLanguage(ctx.guild.id)) || 'en-US';
            const layout = getV2SetupLayout(player as any, client, locale, true);

            const initialMsg = await targetChannel.send(layout as any);
            await client.db.setSetup(ctx.guild.id, targetChannel.id, initialMsg.id);

            return ctx.replyV2({
                title: '🎵 Song Request Channel Set',
                description:
                    `Successfully set ${targetChannel} as the dedicated song request channel!\n\n` +
                    `**How to use:**\n` +
                    `1. Join any voice channel in the server.\n` +
                    `2. Simply type a **song name** or paste a **link** in ${targetChannel}.\n` +
                    `3. The bot will automatically play it, update the player embed, and keep the channel clean!\n\n` +
                    `*To change or remove it later, use \`,music channel set #new-channel\` or \`,music channel delete\`.*`,
                borderless: true,
                color: null
            });
        }

        // Action: CREATE
        if (action === 'create') {
            if (existingChannel) {
                return ctx.replyV2({
                    title: '⚠️ Music Channel Already Exists',
                    description:
                        `A song request channel is already active in ${existingChannel}!\n\n` +
                        `• Simply join a voice channel and send any song title or link in that channel to play.\n` +
                        `• Run \`,music channel set #channel\` to change it, or \`,music channel delete\` to reset.`,
                    borderless: true,
                    color: null
                });
            }

            await ctx.deferReply();

            const channelName = `${client.user?.username || 'enc'}-song-requests`.toLowerCase();
            const textChannel = await ctx.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                topic: '🎵 Song Requests • Simply send any song title or link here to start playing!',
                permissionOverwrites: [
                    {
                        id: ctx.guild.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user!.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            const player = client.lavalink.getPlayer(ctx.guild.id);
            const locale = (await client.db.getLanguage(ctx.guild.id)) || 'en-US';
            const layout = getV2SetupLayout(player as any, client, locale, true);

            const initialMsg = await textChannel.send(layout as any);
            await client.db.setSetup(ctx.guild.id, textChannel.id, initialMsg.id);

            return ctx.replyV2({
                title: '🎵 Song Request Channel Created',
                description:
                    `Successfully created ${textChannel}!\n\n` +
                    `**How to use:**\n` +
                    `1. Join any voice channel in the server.\n` +
                    `2. Simply type a **song name** or paste a **link** in ${textChannel}.\n` +
                    `3. The bot will automatically play it and keep the channel clean!`,
                borderless: true,
                color: null
            });
        }

        // Action: DELETE
        if (action === 'delete' || action === 'remove' || action === 'unset' || action === 'reset') {
            if (!data?.textId) {
                return ctx.replyV2({
                    title: 'ℹ️ No Music Channel Found',
                    description: 'There is no song request channel configured for this server.\nRun `,music channel set #channel` or `,music channel create` to set one up.',
                    borderless: true,
                    color: null
                });
            }

            await client.db.deleteSetup(ctx.guild.id);
            if (existingChannel) {
                if (data.messageId) {
                    await existingChannel.messages.fetch(data.messageId).then(m => m.delete()).catch(() => null);
                }
                // Only delete the channel itself if it was an auto-created enc-song-requests channel
                if (existingChannel.name.includes('song-requests')) {
                    await existingChannel.delete('Music channel deleted by administrator').catch(() => null);
                }
            }

            return ctx.replyV2({
                title: '🗑️ Song Request Channel Deleted',
                description: 'The song request channel setup has been removed and unbound.',
                borderless: true,
                color: null
            });
        }

        // Action: PREFIX
        if (action === 'prefix') {
            if (!existingChannel) {
                return ctx.replyV2({
                    title: '⚠️ No Music Channel Configured',
                    description: 'No song request channel is configured yet! Use `,music channel set #channel` or `,music channel create` first.',
                    isAlert: true,
                    color: client.color.red
                });
            }

            let prefixVal = ctx.isInteraction ? ctx.options.getString('prefix') : null;
            if (!prefixVal && args.length > 1) {
                prefixVal = args[1].trim();
            }

            if (prefixVal) {
                const lower = prefixVal.toLowerCase();
                if (lower === 'remove' || lower === 'none' || lower === 'clear' || lower === 'off' || lower === 'reset' || lower === 'delete') {
                    await client.db.setSetupPrefix(ctx.guild.id, null);
                    return ctx.replyV2({
                        title: '✅ Music Channel Prefix Removed',
                        description: `The prefix requirement for ${existingChannel} has been removed.\n\nNow, all song titles and links sent in that channel will be registered directly.`,
                        borderless: true,
                        color: client.color.main
                    });
                }

                if (prefixVal.length > 10) {
                    return ctx.replyV2({
                        title: '⚠️ Invalid Prefix',
                        description: 'The prefix must be 10 characters or fewer.',
                        isAlert: true,
                        color: client.color.red
                    });
                }

                await client.db.setSetupPrefix(ctx.guild.id, prefixVal);
                return ctx.replyV2({
                    title: '✅ Music Channel Prefix Updated',
                    description:
                        `The prefix for ${existingChannel} has been set to: \`${prefixVal}\`\n\n` +
                        `• Messages starting with \`${prefixVal}\` (e.g. \`${prefixVal}love me not\`) will play that song.\n` +
                        `• Direct links (YouTube, Spotify, etc.) will play automatically.\n` +
                        `• Regular messages without \`${prefixVal}\` will be treated as normal chat and ignored by the music player.\n\n` +
                        `To remove this prefix later, use \`,music channel prefix remove\`.`,
                    borderless: true,
                    color: client.color.main
                });
            }

            const currentPrefix = data?.prefix;
            if (currentPrefix) {
                return ctx.replyV2({
                    title: '🎵 Music Channel Prefix',
                    description:
                        `The current music channel prefix for ${existingChannel} is: \`${currentPrefix}\`\n\n` +
                        `• Songs: \`${currentPrefix}<song name>\` (e.g. \`${currentPrefix}love me not\`)\n` +
                        `• Direct links: Played automatically\n` +
                        `• Normal chat: Ignored by player\n\n` +
                        `**To change:** \`,music channel prefix <new-prefix>\`\n` +
                        `**To remove:** \`,music channel prefix remove\``,
                    borderless: true,
                    color: client.color.main
                });
            } else {
                return ctx.replyV2({
                    title: '🎵 Music Channel Prefix',
                    description:
                        `Currently, **no prefix** is required in ${existingChannel}. Every message or link sent there is treated as a song request.\n\n` +
                        `**To set a prefix:**\n` +
                        `\`,music channel prefix -\` — Only \`-<song>\` or links will play songs.\n\n` +
                        `**To remove:**\n` +
                        `\`,music channel prefix remove\``,
                    borderless: true,
                    color: client.color.main
                });
            }
        }

        // Action: INFO
        if (action === 'info' || action === 'status') {
            if (!data?.textId || !existingChannel) {
                return ctx.replyV2({
                    title: 'ℹ️ Music Channel Status',
                    description: 'No song request channel is currently active.\nRun `,music channel set #channel` or `,music channel create` to set one up!',
                    borderless: true,
                    color: null
                });
            }

            return ctx.replyV2({
                title: '🎵 Music Channel Info',
                description:
                    `**Active Channel:** ${existingChannel}\n` +
                    `**Prefix:** ${data.prefix ? `\`${data.prefix}\`` : '*None (all messages/links)*'}\n` +
                    `**Controller Message:** \`${data.messageId}\`\n\n` +
                    `*Tip: Run \`,music channel prefix <prefix>\` to set a trigger prefix, or \`,music channel delete\` to remove it.*`,
                borderless: true,
                color: null
            });
        }

        return ctx.replyV2({
            title: '⚠️ Invalid Action',
            description:
                'Please specify a valid action: `set`, `create`, `delete`, or `info`.\n\n' +
                '**Examples:**\n' +
                '• `,music channel set #channel`\n' +
                '• `,music channel create`\n' +
                '• `,music channel delete`',
            borderless: true,
            color: null
        });
    }
}
