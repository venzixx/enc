import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

export default class StarboardSetup extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'starboard-setup',
            description: {
                content: 'Configure the starboard system.',
                usage: 'starboard-setup <channel> <count>',
                examples: ['starboard-setup #starboard 3']
            },
            category: 'config',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageGuild],
                client: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'channel',
                    description: 'The channel to send starred messages to',
                    type: 7, // CHANNEL
                    required: true,
                    channel_types: [ChannelType.GuildText]
                },
                {
                    name: 'count',
                    description: 'Number of stars required to post on starboard',
                    type: 4, // INTEGER
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();

        const channel = ctx.options.getChannel('channel') as any;
        const count = ctx.options.getInteger('count')!;

        if (count < 1) {
            return ctx.replyV2({ description: 'Count must be at least 1.', color: client.color.red, isAlert: true });
        }

        try {
            await client.prisma.guild.update({
                where: { id: ctx.guild.id },
                data: {
                    starboardChannelId: channel.id,
                    starboardCount: count
                }
            });

            return ctx.replyV2({
                title: `${client.emoji.success} Starboard Configured`,
                description: `Starboard has been successfully set up!\n\n**Channel:** ${channel}\n**Required Stars:** ${count}`,
                color: client.color.main
            });
        } catch (e: any) {
            return ctx.replyV2({ description: `Failed to configure starboard: ${e.message}`, color: client.color.red, isAlert: true });
        }
    }
}
