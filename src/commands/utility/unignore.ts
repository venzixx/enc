import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Unignore extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'unignore',
            description: {
                content: 'Remove a channel from the bot\'s ignore list.',
                usage: 'unignore [channel]',
                examples: ['unignore', 'unignore #spam']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            },
            options: [
                {
                    name: 'channel',
                    description: 'The channel to unignore (defaults to current)',
                    type: 7,
                    required: false,
                    channel_types: [ChannelType.GuildText]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const channel = ctx.options.getChannel('channel') || ctx.channel;

        const deleted = await client.prisma.ignoredChannel.deleteMany({
            where: { guildId: ctx.guild.id, channelId: channel.id }
        });

        if (deleted.count === 0) {
            return await ctx.reply({ 
                content: `${client.emoji.info} ${channel} was not in the ignore list.`, 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Channel Unignored`)
            .setDescription(`Successfully removed ${channel} from the ignore list. The bot will now respond and track XP there again.`)
            .setColor(client.color.main)
            .setTimestamp();

        return await ctx.reply({ embeds: [embed] });
    }
}
