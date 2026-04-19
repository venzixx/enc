import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    parseEmoji,
    Message
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Steal extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'steal',
			description: {
				content: 'Add an emoji or sticker from another server.',
				usage: 'steal <emoji/sticker_url> [name]',
				examples: ['steal :emoji: cool_emoji', 'steal https://image.url/sticker.png sticker_name']
			},
			category: 'tools',
			cooldown: 5,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageEmojisAndStickers],
				client: [PermissionFlagsBits.ManageEmojisAndStickers]
			},
			options: [
				{
					name: 'emoji',
					description: 'The emoji to steal (or sticker URL)',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'name',
					description: 'The name for the new emoji/sticker',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();
		
		let sourceMessage: Message | null = null;
		let input = ctx.options.getString('emoji') || args[0];
		let name = ctx.options.getString('name') || args[1];

		// Check for reply
		if (ctx.message?.reference?.messageId) {
			sourceMessage = await ctx.channel.messages.fetch(ctx.message.reference.messageId).catch(() => null);
		}

		let extractedEmojis: any[] = [];
		let extractedStickers: any[] = [];

		if (sourceMessage) {
			// Extract from replied message
			const content = sourceMessage.content;
			const emojiRegex = /<(a?):(\w+):(\d+)>/g;
			let match;
			while ((match = emojiRegex.exec(content)) !== null) {
				extractedEmojis.push({
					animated: match[1] === 'a',
					name: match[2],
					id: match[3]
				});
			}
			if (sourceMessage.stickers.size > 0) {
				sourceMessage.stickers.forEach(s => extractedStickers.push(s));
			}
		}

		// If no reply or no emojis in reply, check the input
		if (extractedEmojis.length === 0 && extractedStickers.length === 0 && input) {
			const emojiRegex = /<(a?):(\w+):(\d+)>/g;
			let match;
			while ((match = emojiRegex.exec(input)) !== null) {
				extractedEmojis.push({
					animated: match[1] === 'a',
					name: match[2],
					id: match[3]
				});
			}

			if (extractedEmojis.length === 0) {
				if (input.startsWith('http')) {
					// treat as URL
				} else {
					// Try parseEmoji for a single emoji
					const parsed = parseEmoji(input);
					if (parsed?.id) {
						extractedEmojis.push(parsed);
					}
				}
			}
		}

		if (extractedEmojis.length === 0 && extractedStickers.length === 0 && !input?.startsWith('http')) {
			return await ctx.replyV2({ description: `${client.emoji.cross} No emojis or stickers found to steal.`, isAlert: true });
		}

		const results = [];

		// Handle Emojis
		for (const emoji of extractedEmojis) {
			try {
				const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
				const newEmoji = await ctx.guild.emojis.create({ attachment: url, name: (extractedEmojis.length === 1 && name) ? name : emoji.name });
				results.push(`Emoji: ${newEmoji}`);
			} catch (e) {
				results.push(`Failed to steal emoji ${emoji.name}`);
			}
		}

		// Handle Stickers
		for (const sticker of extractedStickers) {
			try {
				const newSticker = await ctx.guild.stickers.create({ file: sticker.url, name: (extractedStickers.length === 1 && !extractedEmojis.length && name) ? name : sticker.name });
				results.push(`Sticker: **${newSticker.name}**`);
			} catch (e) {
				results.push(`Failed to steal sticker ${sticker.name}`);
			}
		}

		// Handle bare URL
		if (extractedEmojis.length === 0 && extractedStickers.length === 0 && input?.startsWith('http')) {
			try {
				if (input.includes('/stickers/')) {
					const newSticker = await ctx.guild.stickers.create({ file: input, name: name || 'stolen_sticker' });
					results.push(`Sticker: **${newSticker.name}**`);
				} else {
					const newEmoji = await ctx.guild.emojis.create({ attachment: input, name: name || 'stolen_emoji' });
					results.push(`Emoji: ${newEmoji}`);
				}
			} catch (e) {
				results.push(`Failed to steal from URL`);
			}
		}

		if (results.length === 0) {
			return await ctx.replyV2({ description: `${client.emoji.cross} Nothing was stolen.`, isAlert: true });
		}

		const embed = new EmbedBuilder()
			.setTitle(`${client.emoji.success} Success`)
			.setDescription(`Successfully stolen:\n${results.join('\n')}`)
			.setColor(client.color.main)
			.setTimestamp();

		return await ctx.reply({ embeds: [embed] });
	}
}
