import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Ignore extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ignore',
			description: {
				content: 'Manage channels where the bot should not respond or track XP.',
				usage: 'ignore <add/remove/list> [channel]',
				examples: ['ignore add #spam', 'ignore list']
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
					name: 'add',
					description: 'Add a channel to the ignore list',
					type: 1, // SUB_COMMAND
					options: [
						{ 
							name: 'channel', 
							description: 'The channel to ignore', 
							type: 7, 
							required: false,
							channel_types: [ChannelType.GuildText]
						}
					]
				},
				{
					name: 'remove',
					description: 'Remove a channel from the ignore list',
					type: 1, // SUB_COMMAND
					options: [
						{ 
							name: 'channel', 
							description: 'The channel to unignore', 
							type: 7, 
							required: false,
							channel_types: [ChannelType.GuildText]
						}
					]
				},
				{
					name: 'list',
					description: 'List all ignored channels',
					type: 1 // SUB_COMMAND
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const sub = ctx.options.getSubcommand();

		if (sub === 'add') {
			const channel = ctx.options.getChannel('channel') || ctx.channel;
			
			const exists = await client.prisma.ignoredChannel.findFirst({
				where: { guildId: ctx.guild.id, channelId: channel.id }
			});

			if (exists) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(' Already Ignored')
                    .setDescription(`${channel} is already in the ignore list.`)
                    .setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}

			await client.prisma.ignoredChannel.create({
				data: { guildId: ctx.guild.id, channelId: channel.id }
			});

            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Channel Ignored`)
                .setDescription(`Successfully added ${channel} to the ignore list. Bot will no longer respond there.`)
                .setColor(client.color.main)
                .setTimestamp();

			return await ctx.reply({ embeds: [successEmbed], flags: [64] });
		}

		if (sub === 'remove') {
			const channel = ctx.options.getChannel('channel') || ctx.channel;
			await client.prisma.ignoredChannel.deleteMany({
				where: { guildId: ctx.guild.id, channelId: channel.id }
			});

            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Channel Unignored`)
                .setDescription(`Successfully removed ${channel} from the ignore list.`)
                .setColor(client.color.main)
                .setTimestamp();

			return await ctx.reply({ embeds: [successEmbed], flags: [64] });
		}

		if (sub === 'list') {
			const ignored = await client.prisma.ignoredChannel.findMany({
				where: { guildId: ctx.guild.id }
			});

			if (ignored.length === 0) {
                const infoEmbed = new EmbedBuilder()
                    .setTitle(' Ignored Channels')
                    .setDescription('No channels are currently being ignored.')
                    .setColor(client.color.main);
				return await ctx.reply({ embeds: [infoEmbed], flags: [64] });
			}

			const channelsList = ignored.map(i => `<#${i.channelId}>`).join(', ');
			const embed = new EmbedBuilder()
				.setTitle(' Ignored Channels')
				.setDescription(`The bot will ignore commands and XP gain in the following channels:\n\n${channelsList}`)
				.setColor(client.color.main)
                .setTimestamp();

			return await ctx.reply({ embeds: [embed], flags: [64] });
		}
	}
}

