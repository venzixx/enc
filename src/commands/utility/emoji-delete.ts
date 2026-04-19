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
			slashCommand: false,
			hidden: true,
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

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const emojiStr = ctx.options.getString('emoji');
		const parsed = parseEmoji(emojiStr);

		if (!parsed?.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Invalid Emoji')
                .setDescription('Please provide a valid custom emoji from this server.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		const emoji = ctx.guild.emojis.cache.get(parsed.id);
		if (!emoji) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Emoji Not Found')
                .setDescription('Could not find that emoji in this server.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		try {
            const name = emoji.name;
			await emoji.delete();
            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Emoji Deleted`)
                .setDescription(`Successfully removed the emoji: **${name}**`)
                .setColor(client.color.main)
                .setTimestamp();
			await ctx.reply({ embeds: [successEmbed] });
		} catch (e: any) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Deletion Failed')
                .setDescription(`Failed to delete emoji: ${e.message}`)
                .setColor(client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
