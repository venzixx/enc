import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Leaderboard extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'leaderboard',
			description: {
				content: 'View the server leaderboard for various categories.',
				usage: 'leaderboard [category]',
				examples: ['leaderboard category:invite', 'leaderboard category:messages', 'leaderboard category:level']
			},
			category: 'general',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'category',
					description: 'Select the leaderboard category',
					type: 3, // STRING
					required: true,
					choices: [
						{ name: 'Invite Leaderboard', value: 'invite' },
						{ name: 'Message Leaderboard', value: 'messages' },
						{ name: 'Level Leaderboard', value: 'level' }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const type = ctx.options.getString('category') || 'level';
		
		let title = '';
		let description = '';
		let icon = '';

		switch(type) {
			case 'invite':
				title = '\uD83D\uDCE9 Invite Leaderboard';
				icon = '\uD83D\uDCE9';
				const topInvites = await client.prisma.member.findMany({
					where: { guildId: ctx.guild.id, invites: { gt: 0 } },
					orderBy: { invites: 'desc' },
					take: 10
				});
				description = topInvites.length > 0 
					? topInvites.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 \`${m.invites}\` joins`).join('\n')
					: 'No invite data available yet.';
				break;

			case 'messages':
				title = '\uD83D\uDCDD Message Leaderboard';
				icon = '\uD83D\uDCDD';
				const topMessages = await client.prisma.member.findMany({
					where: { guildId: ctx.guild.id, messages: { gt: 0 } },
					orderBy: { messages: 'desc' },
					take: 10
				});
				description = topMessages.length > 0 
					? topMessages.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 \`${m.messages}\` messages`).join('\n')
					: 'No message data available yet.';
				break;

			case 'level':
			default:
				title = '\uD83C\uDFC6 Global Rank Leaderboard';
				icon = '\uD83C\uDFC6';
				const topLevels = await client.prisma.member.findMany({
					where: { guildId: ctx.guild.id, level: { gt: 0 } },
					orderBy: [{ level: 'desc' }, { xp: 'desc' }],
					take: 10
				});
				description = topLevels.length > 0 
					? topLevels.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 Level \`${m.level}\` (\`${m.xp}\` XP)`).join('\n')
					: 'No leveling data available yet.';
				break;
		}

		return await ctx.replyV2({
            title: `**${title}**`,
            description: [
                `Top performers in **${ctx.guild.name}** for **${type.charAt(0).toUpperCase() + type.slice(1)}**.`,
                ``,
                description,
                ``,
                `> Selection refreshed in real-time.`
            ].join('\n'),
            color: client.color.main,
            footer: `Premium Rankings \u2022 Monochromatic V2 Engine`
        });
	}
}
