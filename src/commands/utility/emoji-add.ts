import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class EmojiAdd extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'emoji-add',
			description: {
				content: 'Add a new emoji to the server using an image URL.',
				usage: 'emoji-add <url> <name>',
				examples: ['emoji-add https://example.com/emote.png cool_emote']
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
					name: 'url',
					description: 'Image URL for the new emoji',
					type: 3, // STRING
					required: true
				},
				{
					name: 'name',
					description: 'Name for the new emoji',
					type: 3, // STRING
					required: true
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const url = ctx.options.getString('url');
		const name = ctx.options.getString('name');

		if (!url.startsWith('http')) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Invalid URL')
                .setDescription('Please provide a valid image URL starting with `http` or `https`.')
                .setColor(_client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		try {
			const emoji = await ctx.guild.emojis.create({ attachment: url, name });
            const successEmbed = new EmbedBuilder()
                .setTitle('âœ… Emoji Added')
                .setDescription(`Successfully added the new emoji: **${name}** ${emoji}`)
                .setThumbnail(emoji.url)
                .setColor(_client.color.main)
                .setTimestamp();
			await ctx.reply({ embeds: [successEmbed] });
		} catch (e: any) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Upload Failed')
                .setDescription(`Failed to add emoji: ${e.message}`)
                .setColor(_client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}

