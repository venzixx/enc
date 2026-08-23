import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AfkManager } from '../../utils/AfkManager';

export default class Afk extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'afk',
			description: {
				content: 'Set yourself as AFK globally. Others will be notified when they mention you in any server.',
				usage: 'afk [reason]',
				examples: ['afk', 'afk sleep', 'afk eating', 'afk gaming']
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

		// Check if already AFK globally
		const existing = await AfkManager.getGlobalAfk(client, ctx.author.id);

		if (existing) {
			return await ctx.sendMessage({
				embeds: [
					client.embed()
						.setColor(client.color.main)
						.setDescription(` You are already AFK: **${existing.reason.split('|')[0]}**\n\nSend any message in any server to remove your AFK status.`)
				]
			});
		}

		const name = ctx.author.displayName || ctx.author.username;
		const isUrl = /^(https?:\/\/[^\s]+)$/.test(reason);
		const isDirectMedia = isUrl && (reason.includes('giphy.com') || reason.includes('tenor.com') || reason.match(/\.(gif|jpe?g|png|webp)$/i));
		
		const displayReasonText = isDirectMedia ? '[Media]' : (isUrl ? reason : `**${reason}**`);
		const embed = new EmbedBuilder()
			.setColor(client.color.main)
			.setDescription(` **${name}** is now AFK: ${displayReasonText}`)
			.setFooter({ text: 'Send any message in any server to remove your AFK status' })
			.setTimestamp();

		let finalReason = reason;

		if (isDirectMedia) {
			try {
				if (reason.includes('tenor.com/view/')) {
					const oembedUrl = `https://tenor.com/oembed?url=${encodeURIComponent(reason)}`;
					const response = await fetch(oembedUrl);
					const data = await response.json();
					if (data && data.thumbnail_url) {
						let directUrl = data.thumbnail_url.replace(/\.png$/, '.gif').replace(/AAAAN/, 'AAAAC'); 
						finalReason = `${reason}|${directUrl}`;
						embed.setImage(directUrl);
					}
				} else if (reason.includes('giphy.com/gifs/')) {
					const id = reason.split('-').pop();
					if (id) {
						const directUrl = `https://media.giphy.com/media/${id}/giphy.gif`;
						finalReason = `${reason}|${directUrl}`;
						embed.setImage(directUrl);
					}
				} else {
					embed.setImage(reason);
				}
			} catch (e) {
				console.error('[AFK] Failed to resolve direct media:', e);
			}
		}

		await AfkManager.setGlobalAfk(client, ctx.author.id, ctx.member, finalReason);

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
