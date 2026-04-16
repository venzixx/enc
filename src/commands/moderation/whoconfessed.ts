import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class WhoConfessed extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'whoconfessed',
			description: {
				content: 'Reveal who wrote a specific confession by its number. Admin only.',
				usage: 'whoconfessed <number>',
				examples: ['whoconfessed 1', 'whoconfessed 5']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: []
			},
			options: [
				{
					name: 'number',
					description: 'The confession number to look up (e.g. 1 for Confession #1)',
					type: 4, // INTEGER
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const number = ctx.options.getInteger('number');

		if (!number || number < 1) {
			return await ctx.sendMessage({
				content: 'âŒ Please provide a valid confession number.',
			});
		}

		const confession = await client.prisma.confession.findUnique({
			where: {
				guildId_number: {
					guildId: ctx.guild.id,
					number: number
				}
			}
		});

		if (!confession) {
			const embed = new EmbedBuilder()
				.setTitle('ðŸ” Confession Lookup')
				.setDescription(`âŒ Confession **#${number}** was not found in this server.`)
				.setColor(client.color.red);
			return await ctx.sendMessage({ embeds: [embed] });
		}

		const embed = new EmbedBuilder()
			.setTitle(`ðŸ” Confession #${confession.number} â€” Author Revealed`)
			.setColor(0x2B2D31)
			.addFields(
				{ name: 'ðŸ‘¤ Author', value: `${confession.userTag} (<@${confession.userId}>)`, inline: true },
				{ name: 'ðŸ“… Date', value: `<t:${Math.floor(confession.createdAt.getTime() / 1000)}:R>`, inline: true },
				{ name: 'ðŸ’¬ Content', value: confession.content }
			)
			.setFooter({ text: 'This information is only visible to you.' })
			.setTimestamp();

		// Reply ephemerally so only the admin sees it
		if (ctx.interaction) {
			return await ctx.interaction.reply({ embeds: [embed], ephemeral: true });
		}
		return await ctx.sendMessage({ embeds: [embed] });
	}
}
