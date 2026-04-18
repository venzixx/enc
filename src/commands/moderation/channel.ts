import { ChannelType, EmbedBuilder, CategoryChannel, PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../../utils/AuditLogger';

export default class ChannelManager extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'channel',
            description: {
                content: 'Manage channels: create, move, clone, or nuke.',
                usage: 'channel <create|move|clone|nuke>',
                examples: ['channel create general', 'channel nuke']
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
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand();

        if (sub === 'create') {
            const name = ctx.options.getString('name');
            let category = ctx.options.getChannel('category') as CategoryChannel | null;

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
            const category = ctx.options.getChannel('category') as CategoryChannel;
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;

            if (targetChannel.isDMBased()) return;

            await targetChannel.setParent(category.id, { lockPermissions: true });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Moved`,
                description: `Successfully moved ${targetChannel} to **${category.name}**.`,
                color: client.color.main
            });
        }

        if (sub === 'clone') {
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            if (targetChannel.isDMBased()) return;

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
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            if (targetChannel.isDMBased()) return;

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

            // If we just deleted the channel the interaction was executed in, we can't reply to the interaction!
            if (isCurrentChannel) {
                // Since the interaction payload is gone (channel deleted), it will naturally fail or timeout. 
                // We're good just returning.
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
            const newName = ctx.options.getString('name')!;
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            if (targetChannel.isDMBased()) return;

            const oldName = targetChannel.name;
            await targetChannel.setName(newName);

            await AuditLogger.log(client, ctx.guild, {
                type: AuditLogType.MODERATION,
                event: 'Channel Renamed',
                executorId: ctx.author.id,
                executorTag: ctx.author.tag,
                targetId: targetChannel.id,
                targetName: newName,
                details: `Renamed channel from #${oldName} to #${newName} (via /channel rename)`,
                color: client.color.main
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Channel Renamed`,
                description: `Successfully renamed ${targetChannel} to **${newName}**.`,
                color: client.color.main
            });
        }

        if (sub === 'lock' || sub === 'unlock') {
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            if (targetChannel.isDMBased()) return;

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
            const targetChannel = (ctx.options.getChannel('channel') || ctx.channel) as TextChannel | VoiceChannel;
            if (targetChannel.isDMBased()) return;

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
    }
}
