import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    TextChannel 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Sticky extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'sticky',
			description: {
				content: 'Manage sticky messages in the channel.',
				usage: 'sticky <add/remove/show> [message]',
				examples: ['sticky add Welcome to the server!', 'sticky remove', 'sticky show']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageMessages],
				client: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'add',
					description: 'Add a sticky message to this channel',
					type: 1,
					options: [
						{ name: 'message', description: 'The message content', type: 3, required: true }
					]
				},
				{
					name: 'remove',
					description: 'Remove the sticky message from this channel',
					type: 1
				},
				{
					name: 'show',
					description: 'Show the current sticky message for this channel',
					type: 1
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
		const sub = ctx.options.getSubcommand() || args[0];

		if (sub === 'add') {
			const content = ctx.options.getString('message') || args.slice(1).join(' ');
			if (!content) {
				return await ctx.reply({ content: `${client.emoji.cross} Please provide a message to stick.`, flags: [64] });
			}

			await client.prisma.stickyMessage.upsert({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } },
				update: { content },
				create: { guildId: ctx.guild.id, channelId: ctx.channel.id, content }
			});

			const embed = new EmbedBuilder()
				.setTitle(' Sticky Message Set')
				.setDescription(`The following message will now stick to the bottom of this channel:\n\n${content}`)
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });

		} else if (sub === 'show') {
			const data = await client.prisma.stickyMessage.findUnique({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
			});

			if (!data) {
				const embed = new EmbedBuilder()
					.setTitle(`${client.emoji.cross} No Sticky Message`)
					.setDescription('There is no sticky message set for this channel.')
					.setColor(client.color.red);
				return await ctx.reply({ embeds: [embed] });
			}

			const embed = new EmbedBuilder()
				.setTitle(' Current Sticky Message')
				.setDescription(data.content)
				.setColor(client.color.main)
				.setFooter({ text: 'Sticky Message' })
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });

		} else if (sub === 'remove') {
			await client.prisma.stickyMessage.delete({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
			}).catch(() => null);

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.success} Sticky Removed`)
				.setDescription('Successfully removed the sticky message from this channel.')
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });
		}
	}
}
