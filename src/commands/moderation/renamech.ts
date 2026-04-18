import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';

export default class RenameChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'renamech',
            description: {
                content: 'Renames a specified channel or the current one.',
                usage: 'renamech [channel] <new_name>',
                examples: ['renamech cool-chat', 'renamech #general main-chat']
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
                { name: 'name', description: 'The new name for the channel', type: 3, required: true },
                { name: 'channel', description: 'Channel to rename (defaults to current)', type: 7, required: false }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let newName = ctx.options.getString('name') || (args.length > 1 ? args[1] : args[0]);
        let targetId = ctx.options.getChannel('channel')?.id || (args.length > 1 ? args[0]?.replace(/[<#@!>]/g, '') : null);
        let targetChannel = targetId ? await ctx.guild.channels.fetch(targetId).catch(() => null) : ctx.channel;

        if (!newName) {
            return ctx.replyV2({ description: 'Please provide a new name for the channel.', color: client.color.red, isAlert: true });
        }

        if (!targetChannel || targetChannel.isDMBased()) {
            return ctx.replyV2({ description: 'Invalid channel specified.', color: client.color.red, isAlert: true });
        }

        const oldName = (targetChannel as any).name;

        await (targetChannel as TextChannel | VoiceChannel).setName(newName).catch(err => {
            console.error(err);
            return null;
        });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Renamed',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: newName,
            details: `Renamed channel from #${oldName} to #${newName}`,
            color: client.color.main
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Renamed`,
            description: `Successfully renamed ${targetChannel} to **${newName}**.`,
            color: client.color.main
        });
    }
}
