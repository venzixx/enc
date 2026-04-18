import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class CountingSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'counting-setup',
			description: {
				content: 'Set the channel for the counting minigame.',
				usage: 'counting-setup <channel>',
				examples: ['counting-setup #counting']
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
					description: 'The channel to use for counting',
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
			update: { countingChannel: channel.id, countingCurrent: 0, countingLastUser: null },
			create: { id: ctx.guild.id, countingChannel: channel.id, countingCurrent: 0 }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Setup Complete`)
            .setDescription(`Counting game has been set to ${channel}.\nThe next number is **1**.`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

