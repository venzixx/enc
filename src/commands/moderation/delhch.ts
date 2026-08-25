import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class DeleteChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'delhch',
            description: {
                content: 'Deletes a specified channel or the current one.',
                usage: 'delhch [channel]',
                examples: ['delhch', 'delhch #general']
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
                { name: 'channel', description: 'Channel to delete', type: 7, required: false }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let targetId = ctx.options.getChannel('channel')?.id || args[0]?.replace(/[<#@!>]/g, '');
        let targetChannel = targetId ? await ctx.guild.channels.fetch(targetId).catch(() => null) : ctx.channel;

        if (!targetChannel || targetChannel.isDMBased()) {
            return ctx.replyV2({ description: 'Invalid channel specified.', color: client.color.red, isAlert: true });
        }

        const channelName = (targetChannel as any).name;

        const force = args.includes('--force') || args.includes('-f');
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: 'Delete Channel',
            targetName: `#${channelName} (${targetChannel.id})`,
            dangerLevel: 'danger',
            details: 'This action is irreversible. All messages and attachments in this channel will be permanently deleted.',
            confirmLabel: 'Confirm Delete Channel',
            confirmEmoji: '🗑️',
            force
        });

        if (!confirmed) return;

        await (targetChannel as any).delete(`Deleted by ${ctx.author.tag}`).catch((err: any) => {
            console.error(err);
            return ctx.replyV2({ description: 'Failed to delete channel. Check my permissions.', color: client.color.red, isAlert: true });
        });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Deleted',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: channelName,
            details: `Deleted channel #${channelName} (Direct Command)`,
            color: client.color.red
        });

        // Only reply if it wasn't the current channel (if current, the channel is gone)
        if (targetChannel.id !== ctx.channel.id) {
            return ctx.replyV2({
                title: `${client.emoji.success} Channel Deleted`,
                description: `Successfully deleted **#${channelName}**.`,
                color: client.color.main
            });
        }
    }
}
