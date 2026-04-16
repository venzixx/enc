import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Messages extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'messages',
			description: {
				content: 'View your total message count or the server leaderboard.',
				usage: 'messages [leaderboard/user]',
				examples: ['messages', 'messages leaderboard']
			},
			category: 'general',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to view message count for',
					type: 6, // USER
					required: false
				},
				{
					name: 'leaderboard',
					description: 'Show top 10 message senders',
					type: 5, // BOOLEAN
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const showLb = ctx.options.getBoolean('leaderboard');
		
		if (showLb) {
			const top = await client.prisma.member.findMany({
				where: { guildId: ctx.guild.id },
				orderBy: { messages: 'desc' },
				take: 10
			});

			if (top.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('âŒ No Data')
                    .setDescription('No message data found for this server yet.')
                    .setColor(client.color.red);
                return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
            }

			const lb = top.map((m, i) => `**#${i + 1}** <@${m.userId}> - \`${m.messages}\` messages`).join('\n');
			const embed = new EmbedBuilder()
				.setTitle(`ðŸ† Message Leaderboard: ${ctx.guild.name}`)
				.setDescription(lb)
				.setColor(client.color.main)
                .setTimestamp();
			return await ctx.reply({ embeds: [embed] });
		}

		const user = ctx.options.getUser('user') || ctx.author;
		const data = await client.prisma.member.findUnique({
			where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } }
		});

		if (!data) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ No History')
                .setDescription(`**${user.tag}** has no recorded messages in this server yet.`)
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

        const successEmbed = new EmbedBuilder()
            .setTitle('ðŸ’¬ Message Statistics')
            .setDescription(`**${user.tag}** has sent \`${data.messages}\` messages in this server.`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed], flags: [64] });
	}
}

