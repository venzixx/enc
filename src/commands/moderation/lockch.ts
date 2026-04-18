import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';

export default class LockChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'lockch',
            description: {
                content: 'Locks the current or specified channel for everyone.',
                usage: 'lockch [channel]',
                examples: ['lockch', 'lockch #general']
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
                { name: 'channel', description: 'Channel to lock', type: 7, required: false }
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

        await (targetChannel as TextChannel | VoiceChannel).permissionOverwrites.edit(ctx.guild.roles.everyone, {
            SendMessages: false
        });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Locked',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: (targetChannel as any).name,
            details: `Locked channel #${(targetChannel as any).name} for @everyone`,
            color: client.color.red
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Locked`,
            description: `Successfully locked ${targetChannel} for everyone.`,
            color: client.color.main
        });
    }
}
