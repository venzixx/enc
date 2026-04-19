import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class LevelSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'level-setup',
			description: {
				content: 'Set the channel where level-up notifications will be sent.',
				usage: 'level-setup <channel>',
				examples: ['level-setup #levels']
			},
			category: 'utility',
			cooldown: 3,
			slashCommand: false,
			hidden: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator]
			},
			options: [
				{
					name: 'channel',
					description: 'The channel for level-up messages',
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
			update: { levelChannelId: channel.id },
			create: { id: ctx.guild.id, levelChannelId: channel.id }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Setup Complete`)
            .setDescription(`Level-up notifications will now be sent in ${channel}.`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

