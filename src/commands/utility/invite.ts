import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class InviteCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'invite',
			description: {
				content: 'Check your total successful invites or another user\'s stats.',
				usage: 'invite [user]',
				examples: ['invite', 'invite @User']
			},
			category: 'general',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to view invite count for',
					type: 6, // USER
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const user = ctx.options.getUser('user') || ctx.author;
		
		const data = await client.prisma.member.findUnique({
			where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } }
		});

		const inviteCount = data?.invites || 0;

		return await ctx.replyV2({
            title: `**Invite Statistics**`,
            description: `Performance metrics for **${user.username}** within **${ctx.guild.name}**.`,
            fields: [
                {
                    name: `${client.emoji.edit} **TOTAL INVITES**`,
                    value: `> \`${inviteCount}\` successful joins`,
                    inline: true
                },
                {
                    name: `${client.emoji.rank} **RANK**`,
                    value: `> #${await this.getInviteRank(client, ctx.guild.id, inviteCount)} top inviter`,
                    inline: true
                }
            ],
            color: client.color.main,
            footer: 'Premium Utility \u2022 Invite Tracking System \u2022 V2 Engine'
        });
	}

    private async getInviteRank(client: ExtendedClient, guildId: string, count: number): Promise<number> {
        return await client.prisma.member.count({
            where: {
                guildId: guildId,
                invites: { gt: count }
            }
        }) + 1;
    }
}
