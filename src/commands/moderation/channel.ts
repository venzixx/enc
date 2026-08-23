import { ChannelType, EmbedBuilder, CategoryChannel, PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../../utils/AuditLogger';

export default class ChannelManager extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'channel',
            aliases: ['ch', 'channels'],
            description: {
                content: 'Manage channels: create, move, clone, nuke, rename, lock, unlock, hide, unhide.',
                usage: 'channel <create|move|clone|nuke|rename|lock|unlock|hide|unhide>',
                examples: [
                    'channel clone',
                    'ch clone #general',
                    'ch nuke',
                    'ch create lounge',
                    'ch rename chat',
                    'ch lock'
                ]
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageChannels],
                client: [PermissionFlagsBits.ManageChannels]
            },
            options: [
                {
                    name: 'create',
                    description: 'Creates a new text channel',
                    type: 1, // SUB_COMMAND
                    options: [
                        { name: 'name', description: 'Name of the channel', type: 3, required: true },
                        { name: 'category', description: 'Category to place it in', type: 7, channel_types: [4], required: false } // GUILD_CATEGORY
                    ]
                },
                {
                    name: 'move',
                    description: 'Moves current channel or a specified channel to a category',
                    type: 1,
                    options: [
                        { name: 'category', description: 'Category to move to', type: 7, channel_types: [4], required: true },
                        { name: 'channel', description: 'Channel to move (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'clone',
                    description: 'Duplicates the channel',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to clone (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'nuke',
                    description: 'Deletes and recreates the channel',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to nuke (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'rename',
                    description: 'Renames the channel',
                    type: 1,
                    options: [
                        { name: 'name', description: 'The new name for the channel', type: 3, required: true },
                        { name: 'channel', description: 'Channel to rename (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'lock',
                    description: 'Locks the channel for everyone',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to lock (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'unlock',
                    description: 'Unlocks the channel for everyone',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to unlock (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'hide',
                    description: 'Hides the channel from everyone',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to hide (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'unhide',
                    description: 'Unhides the channel for everyone',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'Channel to unhide (defaults to current)', type: 7, required: false }
                    ]
                },
                {
                    name: 'nsfw',
                    description: 'Sets or toggles the channel to Age-Restricted (NSFW)',
                    type: 1,
                    options: [
                        { name: 'enable', description: 'Enable or disable NSFW mode (defaults to toggle)', type: 5, required: false },
                        { name: 'channel', description: 'Channel to modify (defaults to current)', type: 7, required: false }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let sub: string | null = null;
        try {
            sub = ctx.isInteraction ? ctx.options.getSubcommand() : (args[0]?.toLowerCase() || null);
        } catch {
            sub = args[0]?.toLowerCase() || null;
        }

        if (!sub) {
            return ctx.replyV2({
                title: 'Channel Management Commands',
                description: 'Usage: `,ch <subcommand> [options]` or `,channel <subcommand>`\n\n' +
                    ' `nsfw [on/off] [#channel]` - Sets or toggles channel Age-Restricted (NSFW) status\n' +
                    ' `clone [channel]` - Duplicates the channel with exact settings\n' +
                    ' `nuke [channel]` - Deletes and recreates the channel clean\n' +
                    ' `create <name> [category]` - Creates a new text channel\n' +
                    ' `rename <new-name> [channel]` - Renames the channel\n' +
                    ' `move <category> [channel]` - Moves channel to a category\n' +
                    ' `lock [channel]` - Locks channel for @everyone\n' +
                    ' `unlock [channel]` - Unlocks channel for @everyone\n' +
                    ' `hide [channel]` - Hides channel from @everyone\n' +
                    ' `unhide [channel]` - Unhides channel for @everyone',
                color: client.color.main
            });
        }

        await ctx.deferReply();

        const resolveTargetChannel = (argIndex: number = 1): TextChannel | VoiceChannel | null => {
            if (ctx.isInteraction) {
                return (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            }
            const rawArg = args[argIndex];
            if (!rawArg) return ctx.channel as TextChannel | VoiceChannel;
            const channelId = rawArg.replace(/[<#>]/g, '');
            const found = ctx.guild?.channels.cache.get(channelId) as TextChannel | VoiceChannel;
            return found || (ctx.channel as TextChannel | VoiceChannel);
        };

        if (sub === 'create') {
            const name = ctx.isInteraction ? ctx.options.getString('name') : args[1];
            if (!name) {
                return ctx.replyV2({ title: 'Error', description: 'Please provide a channel name. Usage: `,ch create <name>`', color: client.color.red });
            }

            let category: CategoryChannel | null = null;
            if (ctx.isInteraction) {
                category = ctx.options.getChannel('category') as CategoryChannel | null;
            } else if (args[2]) {
                const catId = args[2].replace(/[<#>]/g, '');
                category = ctx.guild.channels.cache.get(catId) as CategoryChannel | null;
            }

            // default to current category
            if (!category && ctx.channel && !ctx.channel.isDMBased()) {
                const textChannel = ctx.channel as TextChannel;
                category = textChannel.parent;
            }

            const newChannel = await ctx.guild.channels.create({
                name,
                type: ChannelType.GuildText,
                parent: category?.id,
            });

            await AuditLogger.log(
                client,
                ctx.guild,
                {
                    type: AuditLogType.MODERATION,
                    event: 'Channel Created',
                    executorId: ctx.author.id,
                    executorTag: ctx.author.tag,
                    targetId: newChannel.id,
                    targetName: newChannel.name,
                    details: `Created text channel ${newChannel.name}`,
                    color: client.color.main
                }
            );

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Created`,
                description: `Successfully created ${newChannel}.`,
                color: client.color.main
            });
        }

        if (sub === 'move') {
            let category: CategoryChannel | null = null;
            if (ctx.isInteraction) {
                category = ctx.options.getChannel('category') as CategoryChannel;
            } else if (args[1]) {
                const catId = args[1].replace(/[<#>]/g, '');
                category = ctx.guild.channels.cache.get(catId) as CategoryChannel | null;
            }

            if (!category) {
                return ctx.replyV2({ title: 'Error', description: 'Please specify a category. Usage: `,ch move <category-id> [#channel]`', color: client.color.red });
            }

            const targetChannel = resolveTargetChannel(2);
            if (!targetChannel || targetChannel.isDMBased()) return;

            await targetChannel.setParent(category.id, { lockPermissions: true });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Moved`,
                description: `Successfully moved ${targetChannel} to **${category.name}**.`,
                color: client.color.main
            });
        }

        if (sub === 'clone') {
            const targetChannel = resolveTargetChannel(1);
            if (!targetChannel || targetChannel.isDMBased()) return;

            const cloned = await targetChannel.clone();

            await cloned.send({ embeds: [
                new EmbedBuilder()
                    .setDescription(`This channel was cloned by ${ctx.author}.`)
                    .setColor(client.color.main)
            ] });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Cloned`,
                description: `Successfully duplicated to ${cloned}.`,
                color: client.color.main
            });
        }

        if (sub === 'nuke') {
            const targetChannel = resolveTargetChannel(1);
            if (!targetChannel || targetChannel.isDMBased()) return;

            const name = targetChannel.name;
            const isCurrentChannel = targetChannel.id === ctx.channel.id;
            
            // Recreate
            const cloned = await targetChannel.clone({
                name: targetChannel.name,
                position: targetChannel.rawPosition
            });

            await targetChannel.delete(`Nuked by ${ctx.author.tag}`).catch(() => {});

            const nukeEmbed = new EmbedBuilder()
                .setTitle(' Channel Nuked')
                .setImage('https://i.imgur.com/BnjHPh5.gif')
                .setColor(client.color.red)
                .setDescription(`This channel has been nuked by ${ctx.author}.`);

            await cloned.send({ embeds: [nukeEmbed] }).catch(() => {});

            if (isCurrentChannel) {
                return;
            } else {
                return ctx.replyV2({
                    title: `${client.emoji.success} Channel Nuked`,
                    description: `Successfully nuked **#${name}**.`,
                    color: client.color.main
                });
            }
        }

        if (sub === 'rename') {
            const newName = ctx.isInteraction ? ctx.options.getString('name')! : args[1];
            if (!newName) {
                return ctx.replyV2({ title: 'Error', description: 'Please specify a new channel name. Usage: `,ch rename <new-name> [#channel]`', color: client.color.red });
            }

            const targetChannel = ctx.isInteraction ? resolveTargetChannel(1) : (args[2] ? resolveTargetChannel(2) : (ctx.channel as TextChannel | VoiceChannel));
            if (!targetChannel || targetChannel.isDMBased()) return;

            const oldName = targetChannel.name;
            await targetChannel.setName(newName);

            await AuditLogger.log(client, ctx.guild, {
                type: AuditLogType.MODERATION,
                event: 'Channel Renamed',
                executorId: ctx.author.id,
                executorTag: ctx.author.tag,
                targetId: targetChannel.id,
                targetName: newName,
                details: `Renamed channel from #${oldName} to #${newName} (via channel rename)`,
                color: client.color.main
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Renamed`,
                description: `Successfully renamed ${targetChannel} to **${newName}**.`,
                color: client.color.main
            });
        }

        if (sub === 'lock' || sub === 'unlock') {
            const targetChannel = resolveTargetChannel(1);
            if (!targetChannel || targetChannel.isDMBased()) return;

            const isLock = sub === 'lock';
            await targetChannel.permissionOverwrites.edit(ctx.guild.roles.everyone, {
                SendMessages: isLock ? false : null
            });

            await AuditLogger.log(client, ctx.guild, {
                type: AuditLogType.MODERATION,
                event: isLock ? 'Channel Locked' : 'Channel Unlocked',
                executorId: ctx.author.id,
                executorTag: ctx.author.tag,
                targetId: targetChannel.id,
                targetName: targetChannel.name,
                details: `${isLock ? 'Locked' : 'Unlocked'} channel #${targetChannel.name} for @everyone`,
                color: isLock ? client.color.red : client.color.main
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel ${isLock ? 'Locked' : 'Unlocked'}`,
                description: `Successfully ${isLock ? 'locked' : 'unlocked'} ${targetChannel} for everyone.`,
                color: isLock ? client.color.red : client.color.main
            });
        }

        if (sub === 'hide' || sub === 'unhide') {
            const targetChannel = resolveTargetChannel(1);
            if (!targetChannel || targetChannel.isDMBased()) return;

            const isHide = sub === 'hide';
            await targetChannel.permissionOverwrites.edit(ctx.guild.roles.everyone, {
                ViewChannel: isHide ? false : null
            });

            await AuditLogger.log(client, ctx.guild, {
                type: AuditLogType.MODERATION,
                event: isHide ? 'Channel Hidden' : 'Channel Unhidden',
                executorId: ctx.author.id,
                executorTag: ctx.author.tag,
                targetId: targetChannel.id,
                targetName: targetChannel.name,
                details: `${isHide ? 'Hidden' : 'Unhidden'} channel #${targetChannel.name} from @everyone`,
                color: isHide ? client.color.red : client.color.main
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel ${isHide ? 'Hidden' : 'Unhidden'}`,
                description: `Successfully ${isHide ? 'hidden' : 'unhidden'} ${targetChannel} from everyone.`,
                color: isHide ? client.color.red : client.color.main
            });
        }

        if (sub === 'nsfw') {
            const targetChannel = ctx.isInteraction 
                ? resolveTargetChannel(1) 
                : (args[2] ? resolveTargetChannel(2) : (ctx.channel as TextChannel | VoiceChannel));

            if (!targetChannel || targetChannel.isDMBased()) {
                return ctx.replyV2({
                    title: 'Error',
                    description: 'Invalid channel or cannot be executed in DMs.',
                    color: client.color.red
                });
            }

            if (!('setNSFW' in targetChannel)) {
                return ctx.replyV2({
                    title: 'Error',
                    description: 'This channel type does not support Age-Restricted (NSFW) settings.',
                    color: client.color.red
                });
            }

            let newState: boolean;
            if (ctx.isInteraction) {
                const explicitEnable = ctx.options.getBoolean('enable');
                newState = explicitEnable !== null ? explicitEnable : !(targetChannel as TextChannel).nsfw;
            } else {
                const arg = args[1]?.toLowerCase();
                if (arg === 'on' || arg === 'enable' || arg === 'true' || arg === 'yes') {
                    newState = true;
                } else if (arg === 'off' || arg === 'disable' || arg === 'false' || arg === 'no') {
                    newState = false;
                } else {
                    newState = !(targetChannel as TextChannel).nsfw;
                }
            }

            await (targetChannel as TextChannel).setNSFW(newState, `Modified by ${ctx.author.tag}`);

            await AuditLogger.log(client, ctx.guild, {
                type: AuditLogType.MODERATION,
                event: newState ? 'Channel Marked NSFW' : 'Channel Unmarked NSFW',
                executorId: ctx.author.id,
                executorTag: ctx.author.tag,
                targetId: targetChannel.id,
                targetName: targetChannel.name,
                details: `${newState ? 'Enabled' : 'Disabled'} Age-Restricted (NSFW) mode on #${targetChannel.name}`,
                color: newState ? client.color.red : client.color.main
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Updated`,
                description: `Successfully ${newState ? 'marked' : 'unmarked'} ${targetChannel} as **Age-Restricted (NSFW)**.`,
                color: newState ? 0xef4444 : client.color.main
            });
        }
    }
}
