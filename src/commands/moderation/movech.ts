import { PermissionFlagsBits, CategoryChannel, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';

export default class MoveChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'movech',
            description: {
                content: 'Moves a channel to a specific category.',
                usage: 'movech [channel] <category_id>',
                examples: ['movech 1044738221', 'movech #general 1044738221']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: false,
            hidden: true,
            permissions: {
                user: [PermissionFlagsBits.ManageChannels],
                client: [PermissionFlagsBits.ManageChannels]
            },
            options: [
                { name: 'category', description: 'Category ID to move to', type: 7, channel_types: [4], required: true },
                { name: 'channel', description: 'Channel to move (defaults to current)', type: 7, required: false }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let categoryId = ctx.options.getChannel('category')?.id || args[args.length - 1];
        let targetId = ctx.options.getChannel('channel')?.id || (args.length > 1 ? args[0]?.replace(/[<#@!>]/g, '') : null);
        let targetChannel = targetId ? await ctx.guild.channels.fetch(targetId).catch(() => null) : ctx.channel;

        if (!categoryId) {
            return ctx.replyV2({ description: 'Please provide a valid Category ID.', color: client.color.red, isAlert: true });
        }

        if (!targetChannel || targetChannel.isDMBased()) {
            return ctx.replyV2({ description: 'Invalid channel specified.', color: client.color.red, isAlert: true });
        }

        const category = await ctx.guild.channels.fetch(categoryId).catch(() => null);
        if (!category || category.type !== 4) {
            return ctx.replyV2({ description: 'The provided ID is not a valid Category.', color: client.color.red, isAlert: true });
        }

        await (targetChannel as TextChannel | VoiceChannel).setParent(category.id, { lockPermissions: true }).catch(err => {
            console.error(err);
            return null;
        });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Moved',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: (targetChannel as any).name,
            details: `Moved channel #${(targetChannel as any).name} to category ${category.name}`,
            color: client.color.main
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Moved`,
            description: `Successfully moved ${targetChannel} to **${category.name}**.`,
            color: client.color.main
        });
    }
}
