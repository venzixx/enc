import { PermissionFlagsBits, TextChannel, VoiceChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';

export default class HideChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'hidech',
            description: {
                content: 'Hides the current or specified channel from everyone.',
                usage: 'hidech [channel]',
                examples: ['hidech', 'hidech #general']
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
                { name: 'channel', description: 'Channel to hide', type: 7, required: false }
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
            ViewChannel: false
        });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Hidden',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: targetChannel.id,
            targetName: (targetChannel as any).name,
            details: `Hidden channel #${(targetChannel as any).name} from @everyone`,
            color: client.color.red
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Hidden`,
            description: `Successfully hidden ${targetChannel} from everyone.`,
            color: client.color.main
        });
    }
}
