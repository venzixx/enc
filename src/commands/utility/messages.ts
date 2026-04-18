import { 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class Messages extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'messages',
			description: {
				content: 'Check message statistics or leaderboard.',
				usage: 'messages [leaderboard/user]',
				examples: ['messages', 'messages leaderboard', 'messages @User']
			},
			category: 'tools',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'leaderboard',
					description: 'Show the message leaderboard',
					type: ApplicationCommandOptionType.Subcommand
				},
				{
					name: 'user',
					description: 'Check message count for a specific user',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'target',
							description: 'The user to check',
							type: ApplicationCommandOptionType.User,
							required: false
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
		const sub = ctx.options.getSubcommand() || args[0];

		if (sub === 'leaderboard') {
			const topMembers = await client.prisma.member.findMany({
				where: { guildId: ctx.guild.id },
				orderBy: { messages: 'desc' },
				take: 10
			});

			if (topMembers.length === 0) {
				const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.cross} No Data`)
					.setDescription('No message data found for this server.')
					.setColor(client.color.main);
				return await ctx.reply({ embeds: [embed] });
			}

			const leaderboard = await Promise.all(topMembers.map(async (m, i) => {
				const user = await client.users.fetch(m.userId).catch(() => null);
				return `**${i + 1}.** ${user ? user.tag : 'Unknown'}  \`${m.messages}\` messages`;
			}));

			const embed = new EmbedBuilder()
				.setTitle(` Message Leaderboard: ${ctx.guild.name}`)
				.setDescription(leaderboard.join('\n'))
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });

		} else {
            const member = await Resolver.resolveMember(ctx, ctx.options.getMember('target') || args[1]);
            const target = member?.user || ctx.author;

			const data = await client.prisma.member.findUnique({
				where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
			});

			if (!data) {
				const embed = new EmbedBuilder()
                    .setTitle(`${client.emoji.cross} No History`)
					.setDescription(`**${target.tag}** has no message history in this server.`)
					.setColor(client.color.main);
				return await ctx.reply({ embeds: [embed] });
			}

			const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.mic} Message Statistics`)
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.addFields(
					{ name: 'Total Messages', value: `\`${data.messages}\``, inline: true }
				)
				.setColor(client.color.main)
				.setTimestamp();

			return await ctx.reply({ embeds: [embed] });
		}
	}
}
