import { PermissionFlagsBits, EmbedBuilder, TextChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Sticky extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'sticky',
			description: {
				content: 'Manage sticky messages in this channel.',
				usage: 'sticky <add/remove> [message]',
				examples: ['sticky add "Welcome! Read the rules."', 'sticky remove']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageMessages],
				client: [PermissionFlagsBits.ManageMessages]
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
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const sub = ctx.options.getSubcommand();

		if (sub === 'add') {
			const content = ctx.options.getString('message');

			await client.prisma.stickyMessage.upsert({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } },
				update: { content, lastMsgId: null },
				create: { guildId: ctx.guild.id, channelId: ctx.channel.id, content }
			});

			const embed = new EmbedBuilder()
				.setTitle('ðŸ“Œ Sticky Message Set')
				.setDescription(`The following message will now stick to the bottom of this channel:\n\n${content}`)
				.setColor(client.color.main)
                .setTimestamp();

			await ctx.reply({ embeds: [embed] });

			// Send the first sticky
			const msg = await (ctx.channel as TextChannel).send({
				embeds: [
                    new EmbedBuilder()
                        .setDescription(content)
                        .setColor(client.color.main)
                        .setFooter({ text: 'ðŸ“Œ Sticky Message' })
                        .setTimestamp()
                ]
			});

			await client.prisma.stickyMessage.update({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } },
				data: { lastMsgId: msg.id }
			});
		} else {
			const exists = await client.prisma.stickyMessage.findUnique({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
			});

			if (!exists) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('âŒ No Sticky Message')
                    .setDescription('There is no sticky message configured for this channel.')
                    .setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}

			if (exists.lastMsgId) {
				const lastMsg = await ctx.channel.messages.fetch(exists.lastMsgId).catch(() => null);
				if (lastMsg) await lastMsg.delete().catch(() => {});
			}

			await client.prisma.stickyMessage.delete({
				where: { guildId_channelId: { guildId: ctx.guild.id, channelId: ctx.channel.id } }
			});

            const successEmbed = new EmbedBuilder()
                .setTitle('âœ… Sticky Removed')
                .setDescription('Successfully removed the sticky message from this channel.')
                .setColor(client.color.main)
                .setTimestamp();

			await ctx.reply({ embeds: [successEmbed] });
		}
	}
}

