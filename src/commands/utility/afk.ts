import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Afk extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'afk',
			description: {
				content: 'Set yourself as AFK. Others will be notified when they mention you.',
				usage: 'afk [reason]',
				examples: ['afk', 'afk sleeping', 'afk brb in 10 mins']
			},
			category: 'general',
			aliases: ['away'],
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'reason',
					description: 'Why are you going AFK?',
					type: 3, // STRING
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const reason = ctx.options?.getString?.('reason') || args.join(' ') || 'AFK';

		// Check if already AFK
		const existing = await (client.prisma as any).afk.findUnique({
			where: { userId: ctx.author.id }
		});

		if (existing) {
			return await ctx.sendMessage({
				embeds: [
					client.embed()
						.setColor(client.color.main)
						.setDescription(` You are already AFK: **${existing.reason}**\n\nSend any message to remove your AFK status.`)
				]
			});
		}

		await (client.prisma as any).afk.create({
			data: {
				userId: ctx.author.id,
				reason: reason
			}
		});

		const embed = new EmbedBuilder()
			.setColor(client.color.main)
			.setDescription(` **${ctx.author.displayName || ctx.author.username}** is now AFK: **${reason}**`)
			.setFooter({ text: 'Send any message to remove your AFK status' })
			.setTimestamp();

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
