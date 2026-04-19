import { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    parseEmoji 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Emoji extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'emoji',
            description: {
                content: 'Server emoji and sticker management.',
                usage: 'emoji <subcommand>',
                examples: ['emoji steal :emoji: cool_emoji', 'emoji delete :emoji:']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageEmojisAndStickers],
                client: [PermissionFlagsBits.ManageEmojisAndStickers]
            },
            options: [
                {
                    name: 'add',
                    description: 'Add a new emoji using an image URL.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'url', description: 'Image URL', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'name', description: 'Emoji name', type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Remove a custom emoji from the server.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'emoji', description: 'The emoji to delete', type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: 'steal',
                    description: 'Copy an emoji or sticker from another server.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'input', description: 'The emoji or sticker URL', type: ApplicationCommandOptionType.String, required: true },
                        { name: 'name', description: 'The new name', type: ApplicationCommandOptionType.String, required: true }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand() || args[0];

        switch (sub) {
            case 'add':
                return this.handleAdd(client, ctx);
            case 'delete':
                return this.handleDelete(client, ctx);
            case 'steal':
                return this.handleSteal(client, ctx, args);
            default:
                return ctx.replyV2({ description: 'Please specify a valid emoji action.', isAlert: true });
        }
    }

    private async handleAdd(client: ExtendedClient, ctx: Context) {
        const url = ctx.options.getString('url', true);
        const name = ctx.options.getString('name', true);

        if (!url.startsWith('http')) return ctx.replyV2({ description: 'Please provide a valid image URL.', isAlert: true });

        try {
            const emoji = await ctx.guild.emojis.create({ attachment: url, name });
            return await ctx.replyV2({
                title: `${client.emoji.success} Emoji Added`,
                description: `Successfully added **${name}** ${emoji}`,
                media: emoji.url,
                color: client.color.main
            });
        } catch (e: any) {
            return ctx.replyV2({ description: `Upload failed: ${e.message}`, isAlert: true });
        }
    }

    private async handleDelete(client: ExtendedClient, ctx: Context) {
        const emojiStr = ctx.options.getString('emoji', true);
        const parsed = parseEmoji(emojiStr);

        if (!parsed?.id) return ctx.replyV2({ description: 'Please provide a valid custom emoji.', isAlert: true });

        const emoji = ctx.guild.emojis.cache.get(parsed.id);
        if (!emoji) return ctx.replyV2({ description: 'Emoji not found in this server.', isAlert: true });

        try {
            const name = emoji.name;
            await emoji.delete();
            return await ctx.replyV2({ title: `${client.emoji.success} Emoji Deleted`, description: `Successfully removed **${name}**.`, color: client.color.main });
        } catch (e: any) {
            return ctx.replyV2({ description: `Deletion failed: ${e.message}`, isAlert: true });
        }
    }

    private async handleSteal(client: ExtendedClient, ctx: Context, args: string[]) {
        const input = ctx.options.getString('input') || args[1];
        const name = ctx.options.getString('name') || args[2];

        if (!input || !name) return ctx.replyV2({ description: 'Provide an emoji/URL and a name.', isAlert: true });

        try {
            if (input.startsWith('https://')) {
                if (input.includes('/stickers/')) {
                    await ctx.guild.stickers.create({ file: input, name });
                    return await ctx.replyV2({ title: 'Sticker Stolen', description: `Added sticker **${name}**.`, color: client.color.main });
                } else {
                    await ctx.guild.emojis.create({ attachment: input, name });
                    return await ctx.replyV2({ title: 'Emoji Stolen', description: `Added emoji **${name}**.`, color: client.color.main });
                }
            }

            const parsedEmoji = parseEmoji(input);
            if (parsedEmoji?.id) {
                const extension = parsedEmoji.animated ? '.gif' : '.png';
                const url = `https://cdn.discordapp.com/emojis/${parsedEmoji.id}${extension}`;
                await ctx.guild.emojis.create({ attachment: url, name: name || parsedEmoji.name });
                return await ctx.replyV2({ title: 'Emoji Stolen', description: `Added emoji **${name || parsedEmoji.name}**.`, color: client.color.main });
            }
            return ctx.replyV2({ description: 'Invalid emoji or URL.', isAlert: true });
        } catch (e: any) {
            return ctx.replyV2({ description: `Steal failed: ${e.message}`, isAlert: true });
        }
    }
}
