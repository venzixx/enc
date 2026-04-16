import { PermissionFlagsBits, parseEmoji, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Steal extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'steal',
			description: {
				content: 'Steal an emoji or sticker from another server.',
				usage: 'steal <emoji> <name> OR reply with "steal <name>"',
				examples: ['steal :kekw: kekw', 'steal kekw (as reply)']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageEmojisAndStickers],
				client: [PermissionFlagsBits.ManageEmojisAndStickers]
			},
			options: [
				{
					name: 'name',
					description: 'Name for the new emoji/sticker',
					type: 3, // STRING
					required: true
				},
				{
					name: 'emoji',
					description: 'The emoji to steal (direct input)',
					type: 3, // STRING
					required: false
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		let emojiUrl: string | null = null;
		let isSticker = false;
		let name = ctx.options.getString('name', 0) || args[0]; // Name is now 0th option/arg

		// Check for Reply logic
		if (!ctx.interaction && ctx.message?.reference?.messageId) {
			const refMessage = await ctx.channel.messages.fetch(ctx.message.reference.messageId);
			
			// Try Sticker first
			if (refMessage.stickers.size > 0) {
				const sticker = refMessage.stickers.first()!;
				emojiUrl = sticker.url;
				isSticker = true;
				if (!name) name = sticker.name;
			} 
			// Try Emoji in content
			else {
				const emojiRegex = /<a?:(\w{2,32}):(\d{17,20})>/;
				const match = refMessage.content.match(emojiRegex);
				if (match) {
					emojiUrl = `https://cdn.discordapp.com/emojis/${match[2]}.${refMessage.content.includes('<a:') ? 'gif' : 'png'}`;
					if (!name) name = match[1];
				}
			}
		}

		// Fallback to Slash/Direct args if no reply or reply had nothing
		if (!emojiUrl) {
			const emojiStr = ctx.options.getString('emoji', 1) || args[1]; // Emoji is now 1st option/arg
			if (emojiStr) {
				const parsed = parseEmoji(emojiStr);
				if (parsed?.id) {
					emojiUrl = `https://cdn.discordapp.com/emojis/${parsed.id}.${parsed.animated ? 'gif' : 'png'}`;
					if (!name) name = parsed.name;
				}
			}
		}

		if (!emojiUrl) {
			const errorEmbed = new EmbedBuilder()
				.setTitle('âŒ Steal Error')
				.setDescription('Could not find an emoji or sticker to steal. Please provide a valid emoji or reply to a message containing one.')
				.setColor(_client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		if (!name) {
            const errorEmbed = new EmbedBuilder()
				.setTitle('âŒ Steal Error')
				.setDescription('Please provide a name for the stolen emoji/sticker.')
				.setColor(_client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
        }

		try {
			const resEmbed = new EmbedBuilder().setColor(_client.color.main);
			
			if (isSticker) {
				const sticker = await ctx.guild.stickers.create({ file: emojiUrl, name, tags: name });
				resEmbed.setTitle('âœ… Sticker Stolen')
					.setDescription(`Successfully stolen the sticker: **${sticker.name}**`)
					.setImage(emojiUrl);
			} else {
				const emoji = await ctx.guild.emojis.create({ attachment: emojiUrl, name });
				resEmbed.setTitle('âœ… Emoji Stolen')
					.setDescription(`Successfully stolen the emoji: ${emoji} (**${name}**)`)
					.setThumbnail(emojiUrl);
			}

			await ctx.reply({ embeds: [resEmbed] });
		} catch (e: any) {
			const errorEmbed = new EmbedBuilder()
				.setTitle('âŒ Failed to Steal')
				.setDescription(`Error: ${e.message}`)
				.setColor(_client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}

