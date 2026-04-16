import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { generateRankCard } from '../../services/imageBuilder';

export default class Level extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'level',
			description: {
				content: 'Shows your current level and XP.',
				usage: 'level [user]',
				examples: ['level', 'level @Member']
			},
			category: 'info',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'user',
					description: 'The user to view level for',
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

		if (!data) {
			const noDataEmbed = new EmbedBuilder()
				.setTitle('ðŸ“Š Level Status')
				.setDescription(`âŒ **${user.tag}** has no rank record yet. Start chatting to gain XP!`)
				.setColor(client.color.red);
			return await ctx.reply({ embeds: [noDataEmbed], flags: [64] });
		}

		// Calculate Rank
		const rank = await client.prisma.member.count({
			where: {
				guildId: ctx.guild.id,
				xp: { gt: data.xp }
			}
		}) + 1;

		const nextLevelXP = (data.level + 1) * (data.level + 1) * 100;
		
		// Deferred reply as image generation might take a second
		await ctx.interaction?.deferReply();

		try {
			const imageBuffer = await generateRankCard({
				username: user.username,
				avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
				level: data.level,
				rank: rank,
				currentXp: data.xp,
				requiredXp: nextLevelXP,
				status: (ctx.guild.members.cache.get(user.id)?.presence?.status as any) || 'offline'
			});

			const attachment = new AttachmentBuilder(imageBuffer, { name: 'rank.png' });
			
			if (ctx.interaction) {
				await ctx.interaction.editReply({ files: [attachment] });
			} else {
				await ctx.reply({ files: [attachment] });
			}
		} catch (error) {
			console.error('Rank Card Error:', error);
			const embed = new EmbedBuilder()
				.setTitle(`ðŸ“Š Rank: ${user.username}`)
				.setColor(0x000000)
				.setThumbnail(user.displayAvatarURL())
				.addFields(
					{ name: 'âœ¨ Level', value: `\`${data.level}\``, inline: true },
					{ name: 'ðŸ’« XP', value: `\`${data.xp} / ${nextLevelXP}\``, inline: true },
					{ name: 'ðŸ“ˆ Progress', value: `\`${Math.floor((data.xp / nextLevelXP) * 100)}%\``, inline: true }
				)
				.setFooter({ text: `Keep chatting to level up!` });

			if (ctx.interaction) {
				await ctx.interaction.editReply({ embeds: [embed] });
			} else {
				await ctx.reply({ embeds: [embed] });
			}
		}
	}
}

