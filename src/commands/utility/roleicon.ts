import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { PermissionFlagsBits } from 'discord.js';

export default class RoleIcon extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'roleicon',
            description: {
                content: 'Changes the icon of a role.',
                usage: 'roleicon <role> <icon_url_or_emoji>',
                examples: ['roleicon @Admin 👑']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageRoles],
                client: [PermissionFlagsBits.ManageRoles]
            },
            options: [
                {
                    name: 'role',
                    description: 'The role to change',
                    type: 8, // ROLE
                    required: true
                },
                {
                    name: 'icon',
                    description: 'Emoji (unicode) or Image URL for the role icon',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        await ctx.deferReply();
        const role = ctx.options.getRole('role') as any;
        const iconInput = ctx.options.getString('icon')!;

        // Discord Server must be Level 2 for role icons
        if (ctx.guild.premiumTier < 2) {
            return ctx.replyV2({ description: 'Server level must be at least 2 to have Role Icons.', color: client.color.red, isAlert: true });
        }

        try {
            // Check if it's a custom emoji like <:name:id> or <a:name:id>
            const customEmojiMatch = iconInput.match(/^<(a?):(\w+):(\d+)>$/);
            if (customEmojiMatch) {
                const isAnimated = customEmojiMatch[1] === 'a';
                const emojiId = customEmojiMatch[3];
                const ext = isAnimated ? 'gif' : 'png';
                const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=128&quality=lossless`;
                await role.edit({ icon: emojiUrl }, `Requested by ${ctx.author.tag}`);
            } else if (iconInput.startsWith('http')) {
                await role.edit({ icon: iconInput }, `Requested by ${ctx.author.tag}`);
            } else {
                // Treat as unicode emoji
                await role.edit({ unicodeEmoji: iconInput }, `Requested by ${ctx.author.tag}`);
            }
            
            return ctx.replyV2({ 
                title: `${client.emoji.success} Role Icon Updated`, 
                description: `Successfully updated the icon for ${role}.`, 
                color: client.color.main 
            });
        } catch (e: any) {
            return ctx.replyV2({ description: `Failed to update role icon: ${e.message}`, color: client.color.red, isAlert: true });
        }
    }
}
