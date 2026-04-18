import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    parseEmoji 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Steal extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'steal',
			description: {
				content: 'Add an emoji or sticker from another server.',
				usage: 'steal <emoji/sticker_url> <name>',
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
					required: true
				},
				{
					name: 'name',
					description: 'The name for the new emoji/sticker',
					type: ApplicationCommandOptionType.String,
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();
		
		const input = ctx.options.getString('emoji') || args[0];
		const name = ctx.options.getString('name') || args[1];

		if (!input || !name) {
			return await ctx.reply({ content: `${client.emoji.cross} Please provide an emoji/url and a name.`, flags: [64] });
		}

		try {
			if (input.startsWith('https://')) {
				// Handle sticker or image URL
				if (input.includes('/stickers/')) {
					await ctx.guild.stickers.create({ file: input, name });
					const embed = new EmbedBuilder()
						.setTitle(`${client.emoji.success} Sticker Stolen`)
						.setDescription(`Successfully added sticker **${name}** to the server.`)
						.setColor(client.color.main)
						.setTimestamp();
					return await ctx.reply({ embeds: [embed] });
				} else {
					await ctx.guild.emojis.create({ attachment: input, name });
					const embed = new EmbedBuilder()
						.setTitle(`${client.emoji.success} Emoji Stolen`)
						.setDescription(`Successfully added emoji **${name}** to the server.`)
						.setColor(client.color.main)
						.setTimestamp();
					return await ctx.reply({ embeds: [embed] });
				}
			}

			const parsedEmoji = parseEmoji(input);
			if (parsedEmoji?.id) {
				const extension = parsedEmoji.animated ? '.gif' : '.png';
				const url = `https://cdn.discordapp.com/emojis/${parsedEmoji.id}${extension}`;
				await ctx.guild.emojis.create({ attachment: url, name: name || parsedEmoji.name });
				
				const embed = new EmbedBuilder()
					.setTitle(`${client.emoji.success} Emoji Stolen`)
					.setDescription(`Successfully added emoji **${name || parsedEmoji.name}** to the server.`)
					.setColor(client.color.main)
					.setTimestamp();
				return await ctx.reply({ embeds: [embed] });
			} else {
				return await ctx.reply({ content: `${client.emoji.cross} Invalid emoji or URL provided.`, flags: [64] });
			}
		} catch (error: any) {
			const errorEmbed = new EmbedBuilder()
				.setTitle(`${client.emoji.cross} Failed to Steal`)
				.setDescription(`An error occurred: ${error.message}`)
				.setColor(client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
