import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class StorySetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'story-setup',
			description: {
				content: 'Set the channel for the collaborative story game.',
				usage: 'story-setup <channel>',
				examples: ['story-setup #story']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator]
			},
			options: [
				{
					name: 'channel',
					description: 'The channel for the story game',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildText]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel');

		await client.prisma.story.upsert({
			where: { guildId_channelId: { guildId: ctx.guild.id, channelId: channel.id } },
			update: { isActive: true },
			create: { guildId: ctx.guild.id, channelId: channel.id, content: '' }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Setup Complete`)
            .setDescription(`Collaborative story game has been set to ${channel}. Start by writing a word!`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

