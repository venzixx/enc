import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { isDev } from '../../utils/devCheck';
import { V2Helper } from '../../utils/V2Helper';

export default class WhoConfessed extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'whoconfessed',
			description: {
				content: 'Reveal who wrote a specific confession by its number. Developer only.',
				usage: 'whoconfessed <number>',
				examples: ['whoconfessed 1', 'whoconfessed 5']
			},
			category: 'dev',
			aliases: ['whoc'],
			cooldown: 3,
			slashCommand: false,
			hidden: true,
			permissions: {
				dev: true,
				client: [PermissionFlagsBits.EmbedLinks]
			}
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		if (!await isDev(client, ctx.author.id)) return;

		const number = parseInt(args[0], 10);
		const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };

		if (!number || isNaN(number) || number < 1) {
			return await ctx.replyV2({
				title: `${client.emoji.cross} Invalid Number`,
				description: 'Please provide a valid confession number to look up. Example: `,whoconfessed 1`',
				borderless: true,
				color: null,
				isAlert: true,
				ephemeral: true,
				allowedMentions
			});
		}

		if (!ctx.guild) {
			return await ctx.replyV2({
				description: `${client.emoji.cross} This command can only be used in a server.`,
				isAlert: true
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
			return await ctx.replyV2({
				title: 'Confession Lookup',
				description: `${client.emoji.cross} Confession **#${number}** was not found in this server.`,
				borderless: true,
				color: null,
				isAlert: true,
				ephemeral: true,
				allowedMentions
			});
		}

		const layoutOptions = {
			title: `Confession #${confession.number} Author Revealed`,
			description: confession.content,
			fields: [
				{ name: `${client.emoji.user} Author`, value: `${confession.userTag} (<@${confession.userId}>)`, inline: true },
				{ name: 'Date', value: `<t:${Math.floor(confession.createdAt.getTime() / 1000)}:R>`, inline: true }
			],
			borderless: true,
			color: null,
			footer: `Server: ${ctx.guild.name} • Strictly confidential`,
			allowedMentions
		};

		// Send via DM if used as prefix command so confession identity is never leaked in the guild channel
		if (ctx.message) {
			try {
				const dmLayout = V2Helper.createLayout(layoutOptions);
				await ctx.author.send(dmLayout as any);
				if (ctx.message.deletable) {
					await ctx.message.delete().catch(() => {});
				}
				return;
			} catch {
				// If DMs blocked, fall back to replying in channel
			}
		}

		return await ctx.replyV2({
			...layoutOptions,
			ephemeral: true
		});
	}
}
