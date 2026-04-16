import { EmbedBuilder, PermissionFlagsBits, parseEmoji } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class EmojiDelete extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'emoji-delete',
			description: {
				content: 'Remove a custom emoji from the server.',
				usage: 'emoji-delete <emoji>',
				examples: ['emoji-delete :kekw:']
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
					name: 'emoji',
					description: 'The emoji to delete from the server',
					type: 3, // STRING
					required: true
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const emojiStr = ctx.options.getString('emoji');
		const parsed = parseEmoji(emojiStr);

		if (!parsed?.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Invalid Emoji')
                .setDescription('Please provide a valid custom emoji from this server.')
                .setColor(_client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		const emoji = ctx.guild.emojis.cache.get(parsed.id);
		if (!emoji) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Emoji Not Found')
                .setDescription('Could not find that emoji in this server.')
                .setColor(_client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		try {
            const name = emoji.name;
			await emoji.delete();
            const successEmbed = new EmbedBuilder()
                .setTitle('âœ… Emoji Deleted')
                .setDescription(`Successfully removed the emoji: **${name}**`)
                .setColor(_client.color.main)
                .setTimestamp();
			await ctx.reply({ embeds: [successEmbed] });
		} catch (e: any) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Deletion Failed')
                .setDescription(`Failed to delete emoji: ${e.message}`)
                .setColor(_client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
