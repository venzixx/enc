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

		const name = ctx.author.displayName || ctx.author.username;
		const isUrl = /^(https?:\/\/[^\s]+)$/.test(reason);
		const isMedia = isUrl && (reason.includes('giphy.com') || reason.includes('tenor.com') || reason.match(/\.(gif|jpe?g|png|webp)$/i));
		
		const displayReason = isMedia ? '[Media]' : (isUrl ? reason : `**${reason}**`);
		const embed = new EmbedBuilder()
			.setColor(client.color.main)
			.setDescription(` **${name}** is now AFK: ${displayReason}`)
			.setFooter({ text: 'Send any message to remove your AFK status' })
			.setTimestamp();

		// Change server nickname to [AFK] Nickname (safely truncated to 32 characters using Array.from to support surrogate pairs/emojis)
		if (ctx.member) {
			const currentNickname = ctx.member.nickname;
			const baseName = currentNickname || ctx.author.displayName || ctx.author.username;
			if (!baseName.startsWith('[AFK]')) {
				const afkName = Array.from(`[AFK] ${baseName}`).slice(0, 32).join('');
				await ctx.member.setNickname(afkName).catch(() => {});
			}
		}

		if (isMedia) {
			try {
				if (reason.includes('tenor.com/view/')) {
					console.log(`[DEBUG] Resolving Tenor via oEmbed: ${reason}`);
					const oembedUrl = `https://tenor.com/oembed?url=${encodeURIComponent(reason)}`;
					const response = await fetch(oembedUrl);
					const data = await response.json();
					console.log(`[DEBUG] Tenor oEmbed data: ${JSON.stringify(data)}`);
					
					if (data && data.thumbnail_url) {
						// Convert thumbnail .png to .gif and try to get the full version
						let directUrl = data.thumbnail_url.replace(/\.png$/, '.gif');
						// Often the thumbnail is AAAAN but the GIF is AAAAC or AAAAM
						directUrl = directUrl.replace(/AAAAN/, 'AAAAC'); 
						
						console.log(`[DEBUG] Resolved Tenor GIF (via oEmbed): ${directUrl}`);
						await (client.prisma as any).afk.create({
							data: {
								userId: ctx.author.id,
								reason: `${reason}|${directUrl}`
							}
						});
						embed.setImage(directUrl);
						return await ctx.sendMessage({ embeds: [embed] });
					}
				} else if (reason.includes('giphy.com/gifs/')) {
					const id = reason.split('-').pop();
					if (id) {
						const directUrl = `https://media.giphy.com/media/${id}/giphy.gif`;
						await (client.prisma as any).afk.create({
							data: {
								userId: ctx.author.id,
								reason: `${reason}|${directUrl}`
							}
						});
						embed.setImage(directUrl);
						return await ctx.sendMessage({ embeds: [embed] });
					}
				}
			} catch (e) {
				console.error('[DEBUG] Failed to resolve media:', e);
			}
		}

		await (client.prisma as any).afk.create({
			data: {
				userId: ctx.author.id,
				reason: reason
			}
		});

		if (isMedia) embed.setImage(reason);

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
