import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AfkManager } from '../../utils/AfkManager';

export default class Safk extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'safk',
			description: {
				content: 'Set yourself as AFK only in this server. Others will be notified when they ping you.',
				usage: 'safk [reason]',
				examples: ['safk', 'safk sleep', 'safk studying', 'safk gaming']
			},
			category: 'general',
			aliases: ['serverafk'],
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'reason',
					description: 'Why are you going AFK in this server?',
					type: 3, // STRING
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		if (!ctx.guild) {
			return await ctx.sendMessage({ content: 'This command can only be used in a server.' });
		}

		const reason = ctx.options?.getString?.('reason') || args.join(' ') || 'AFK';

		// Check if already Server AFK in this guild
		const existing = AfkManager.getServerAfk(ctx.guild.id, ctx.author.id);
		if (existing) {
			return await ctx.sendMessage({
				embeds: [
					client.embed()
						.setColor(client.color.main)
						.setDescription(` You are already Server AFK in this server: **${existing.reason.split('|')[0]}**\n\nSend any message in this server to remove your Server AFK status.`)
				]
			});
		}

		const name = ctx.member?.displayName || ctx.author.displayName || ctx.author.username;
		const isUrl = /^(https?:\/\/[^\s]+)$/.test(reason);
		const isDirectMedia = isUrl && (reason.includes('giphy.com') || reason.includes('tenor.com') || reason.match(/\.(gif|jpe?g|png|webp)$/i));
		
		const displayReasonText = isDirectMedia ? '[Media]' : (isUrl ? reason : `**${reason}**`);
		const embed = new EmbedBuilder()
			.setColor(client.color.main)
			.setDescription(` **${name}** is now AFK in this server: ${displayReasonText}`)
			.setFooter({ text: 'Send any message in this server to remove your Server AFK status' })
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
				console.error('[SAFK] Failed to resolve direct media:', e);
			}
		}

		await AfkManager.setServerAfk(client, ctx.author.id, ctx.guild.id, ctx.member, finalReason);

		return await ctx.sendMessage({ embeds: [embed] });
	}
}
