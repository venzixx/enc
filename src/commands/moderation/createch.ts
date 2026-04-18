import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';

export default class CreateChannel extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'createch',
            description: {
                content: 'Creates a new text channel.',
                usage: 'createch <name> [category]',
                examples: ['createch general', 'createch rules 1044738221']
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
                { name: 'name', description: 'Name of the channel', type: 3, required: true },
                { name: 'category', description: 'Category ID to place it in', type: 7, channel_types: [4], required: false }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        let name = ctx.options.getString('name') || args[0];
        let categoryId = ctx.options.getChannel('category')?.id || args[1];

        // Default to current category if none provided
        if (!categoryId && ctx.channel && !ctx.channel.isDMBased()) {
            categoryId = (ctx.channel as any).parentId;
        }

        if (!name) {
            return ctx.replyV2({ description: 'Please provide a name for the channel.', color: client.color.red, isAlert: true });
        }

        const newChannel = await ctx.guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: categoryId
        }).catch((err: any) => {
            console.error(err);
            return null;
        });

        if (!newChannel) {
            return ctx.replyV2({ description: 'Failed to create channel. Check my permissions or category ID.', color: client.color.red, isAlert: true });
        }

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Channel Created',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: newChannel.id,
            targetName: newChannel.name,
            details: `Created text channel ${newChannel.name} (Direct Command)`,
            color: client.color.main
        });

        return ctx.replyV2({
            title: `${client.emoji.success} Channel Created`,
            description: `Successfully created ${newChannel}.`,
            color: client.color.main
        });
    }
}
