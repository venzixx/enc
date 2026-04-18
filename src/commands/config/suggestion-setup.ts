import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class SuggestionSetup extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'suggestion-setup',
            description: {
                content: 'Set the channel where suggestions will be posted.',
                usage: 'suggestion-setup <channel>',
                examples: ['suggestion-setup #suggestions']
            },
            category: 'config',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            },
            options: [
                {
                    name: 'channel',
                    description: 'The channel to post suggestions in',
                    type: 7, // CHANNEL
                    required: true,
                    channel_types: [ChannelType.GuildText]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const channel = ctx.options.getChannel('channel');

        await client.prisma.guild.upsert({
            where: { id: ctx.guild.id },
            update: { suggestionChannelId: channel.id },
            create: { id: ctx.guild.id, suggestionChannelId: channel.id }
        });

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Suggestion System Set Up`)
            .setDescription(`Suggestions will now be posted in ${channel}.\nUsers can use \`/suggest\` to submit their ideas!`)
            .setColor(client.color.main)
            .setTimestamp();

        return await ctx.reply({ embeds: [embed] });
    }
}
