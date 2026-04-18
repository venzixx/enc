import { 
    ApplicationCommandOptionType,
    AttachmentBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { RankCardGenerator } from '../../utils/RankCardGenerator';

export default class Level extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'level',
			description: {
				content: 'Check your current level and XP with a premium status card.',
				usage: 'level [user]',
				examples: ['level', 'level @User']
			},
			category: 'tools',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to check level for',
					type: ApplicationCommandOptionType.User,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        // 1. Resolve target member (Fallback to author if no input is provided)
        let member = await Resolver.resolveMember(ctx);
        if (!member) {
            // Check if there was actually an input attempted
            const input = ctx.isInteraction ? null : args[0];
            if (!input) {
                // Singleton execution (No input, show author)
                member = ctx.member!;
            } else {
                // Failed to resolve a specific search term
                return await ctx.reply({ content: `${client.emoji.cross} Could not find that member.`, flags: [64] });
            }
        }

        const user = member.user;
		const data = await client.prisma.member.findUnique({
			where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } }
		});

		if (!data) {
			return await ctx.reply({ 
                content: user.id === ctx.author.id 
                    ? ' You have no rank record yet. Start chatting to gain XP!'
                    : `${client.emoji.cross} **${user.username}** has no rank record yet.`,
                flags: [64]
            });
		}

        // 2. Calculate Rank (Position in Guild)
        const rank = await client.prisma.member.count({
            where: {
                guildId: ctx.guild.id,
                xp: { gt: data.xp }
            }
        }) + 1;

		const nextLevelXP = (data.level + 1) * (data.level + 1) * 100;

        // 3. Manifest the Card
        try {
            const cardBuffer = await RankCardGenerator.generate({
                username: user.username,
                avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
                level: data.level,
                rank: rank,
                currentXp: data.xp,
                requiredXp: nextLevelXP
            });

            const attachment = new AttachmentBuilder(cardBuffer, { name: `rank-${user.id}.png` });
            
            await ctx.reply({ 
                files: [attachment] 
            });
        } catch (error) {
            console.error('Level Command Error:', error);
            await ctx.reply({
                content: ` **${user.username}**  **Level ${data.level}** | **XP: ${data.xp}/${nextLevelXP}** | **Rank #${rank}**`,
            });
        }
	}
}
