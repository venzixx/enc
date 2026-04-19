import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandType,
    Message
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class StealContext extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'Steal',
			type: ApplicationCommandType.Message, // Making it a context menu command
			category: 'tools',
			cooldown: 5,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageEmojisAndStickers],
				client: [PermissionFlagsBits.ManageEmojisAndStickers]
			}
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();
		
		const sourceMessage = ctx.targetMessage;

		if (!sourceMessage) {
			return await ctx.replyV2({ description: `${client.emoji.cross} Failed to find the target message.`, isAlert: true });
		}

		let extractedEmojis: any[] = [];
		let extractedStickers: any[] = [];

		// Extract from target message
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

		if (extractedEmojis.length === 0 && extractedStickers.length === 0) {
			return await ctx.replyV2({ description: `${client.emoji.cross} No emojis or stickers found to steal in that message.`, isAlert: true });
		}

		const results = [];

		// Handle Emojis
		for (const emoji of extractedEmojis) {
			try {
				const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
				const newEmoji = await ctx.guild.emojis.create({ attachment: url, name: emoji.name });
				results.push(`Emoji: ${newEmoji}`);
			} catch (e) {
				results.push(`Failed to steal emoji ${emoji.name}`);
			}
		}

		// Handle Stickers
		for (const sticker of extractedStickers) {
			try {
				const newSticker = await ctx.guild.stickers.create({ file: sticker.url, name: sticker.name });
				results.push(`Sticker: **${newSticker.name}**`);
			} catch (e) {
				results.push(`Failed to steal sticker ${sticker.name}`);
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
