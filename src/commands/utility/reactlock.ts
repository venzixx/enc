import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

const EMOJI_REGEX = /(<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}])+/u;

export default class ReactLock extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'reactlock',
            aliases: ['rl'],
            description: {
                content: 'Automatically react to every message from a specific user or role.',
                usage: 'reactlock <add/remove/list> [user/role] [emoji]',
                examples: ['reactlock add @User 👋', 'reactlock add @Role ❤️', 'reactlock remove @User 👋', 'reactlock list']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageMessages],
                client: [PermissionFlagsBits.AddReactions]
            },
            options: [
                {
                    name: 'add',
                    description: 'Add a reactlock on a user or role',
                    type: 1,
                    options: [
                        {
                            name: 'target',
                            description: 'The user or role to react to',
                            type: 9, // MENTIONABLE (user or role)
                            required: true
                        },
                        {
                            name: 'emoji',
                            description: 'The emoji to react with',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove a reactlock from a user or role',
                    type: 1,
                    options: [
                        {
                            name: 'target',
                            description: 'The user or role to stop reacting to',
                            type: 9,
                            required: true
                        },
                        {
                            name: 'emoji',
                            description: 'The emoji to remove',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all reactlocks in this server',
                    type: 1
                }
            ]
        });
    }

    /**
     * Parse target (user/role mention) and emoji from raw message content.
     * Format: ,reactlock add <@user/@role> <emoji>
     */
    private parsePrefixArgs(ctx: Context): { targetId: string; targetType: 'user' | 'role'; emoji: string } | null {
        const msg = ctx.message;
        if (!msg) return null;

        const content = msg.content;
        const match = content.match(/(?:reactlock|rl)\s+(add|remove)\s+([\s\S]+)/i);
        if (!match) return null;

        const rawArgs = match[2].trim();
        if (!rawArgs) return null;

        // Extract the mention (user or role) and the emoji
        // User mention: <@123> or <@!123>
        // Role mention: <@&123>
        const mentionMatch = rawArgs.match(/^(<@[!&]?\d{17,20}>)\s+/);
        if (!mentionMatch) return null;

        const mentionStr = mentionMatch[1];
        const rest = rawArgs.slice(mentionMatch[0].length).trim();

        // Determine target type and ID
        let targetId: string;
        let targetType: 'user' | 'role';

        const roleMention = mentionStr.match(/^<@&(\d{17,20})>$/);
        const userMention = mentionStr.match(/^<@!?(\d{17,20})>$/);

        if (roleMention) {
            targetId = roleMention[1];
            targetType = 'role';
        } else if (userMention) {
            targetId = userMention[1];
            targetType = 'user';
        } else {
            return null;
        }

        // Rest should be the emoji
        const emoji = rest.trim();
        if (!emoji) return null;

        // Validate it's an emoji
        const isCustomEmoji = /^<a?:\w+:\d+>$/.test(emoji);
        const isUnicodeEmoji = EMOJI_REGEX.test(emoji);
        if (!isCustomEmoji && !isUnicodeEmoji) return null;

        return { targetId, targetType, emoji };
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let sub: string | null = null;
        try { sub = ctx.options.getSubcommand(); } catch { /* prefix command */ }
        if (!sub) sub = args[0]?.toLowerCase() || null;

        if (!sub || !['add', 'remove', 'list'].includes(sub)) {
            return ctx.replyV2({ description: 'Invalid subcommand. Use `add`, `remove`, or `list`.', isAlert: true });
        }

        if (sub === 'add') {
            let targetId: string | null = null;
            let targetType: 'user' | 'role' = 'user';
            let emoji: string | null = null;

            // Slash command: use mentionable option
            if (ctx.interaction) {
                const mentionable = ctx.options.getMentionable('target');
                emoji = ctx.options.getString('emoji');
                if (mentionable) {
                    targetId = mentionable.id;
                    // Check if it's a role or user
                    targetType = 'roleId' in mentionable ? 'role' : 'user';
                }
            } else {
                // Prefix command: parse from raw content
                const parsed = this.parsePrefixArgs(ctx);
                if (parsed) {
                    targetId = parsed.targetId;
                    targetType = parsed.targetType;
                    emoji = parsed.emoji;
                }
            }

            if (!targetId || !emoji) {
                return ctx.replyV2({ description: 'Please provide a user/role and an emoji.\n**Usage:** `reactlock add <@user/@role> <emoji>`', isAlert: true });
            }

            // Validate emoji
            const isCustomEmoji = /^<a?:\w+:\d+>$/.test(emoji);
            const isUnicodeEmoji = EMOJI_REGEX.test(emoji);
            if (!isCustomEmoji && !isUnicodeEmoji) {
                return ctx.replyV2({ description: `\`${emoji}\` is not a valid emoji.`, isAlert: true });
            }

            // Check limit (max 20 per guild)
            const count = await (client.prisma as any).reactLock.count({
                where: { guildId: ctx.guild.id }
            });

            if (count >= 20) {
                return ctx.replyV2({ description: 'You can only have up to **20** reactlocks per server.', isAlert: true });
            }

            // Check for duplicate
            const existing = await (client.prisma as any).reactLock.findUnique({
                where: { guildId_targetId_emoji: { guildId: ctx.guild.id, targetId, emoji } }
            });

            if (existing) {
                return ctx.replyV2({ description: 'This reactlock already exists.', isAlert: true });
            }

            await (client.prisma as any).reactLock.create({
                data: {
                    guildId: ctx.guild.id,
                    targetId,
                    targetType,
                    emoji
                }
            });

            const displayTarget = targetType === 'role' ? `<@&${targetId}>` : `<@${targetId}>`;

            const embed = client.embed()
                .setTitle('React Lock Added')
                .setDescription(`Every message from ${displayTarget} will now get a ${emoji} reaction.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        } else if (sub === 'remove') {
            let targetId: string | null = null;
            let emoji: string | null = null;

            if (ctx.interaction) {
                const mentionable = ctx.options.getMentionable('target');
                emoji = ctx.options.getString('emoji');
                if (mentionable) targetId = mentionable.id;
            } else {
                const parsed = this.parsePrefixArgs(ctx);
                if (parsed) {
                    targetId = parsed.targetId;
                    emoji = parsed.emoji;
                }
            }

            if (!targetId || !emoji) {
                return ctx.replyV2({ description: 'Please provide the user/role and emoji to remove.\n**Usage:** `reactlock remove <@user/@role> <emoji>`', isAlert: true });
            }

            const deleted = await (client.prisma as any).reactLock.deleteMany({
                where: { guildId: ctx.guild.id, targetId, emoji }
            });

            if (deleted.count === 0) {
                return ctx.replyV2({ description: 'No matching reactlock found.', isAlert: true });
            }

            const embed = client.embed()
                .setTitle('React Lock Removed')
                .setDescription(`Removed ${emoji} reactlock from <@${targetId}>.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        } else if (sub === 'list') {
            const locks = await (client.prisma as any).reactLock.findMany({
                where: { guildId: ctx.guild.id }
            });

            if (locks.length === 0) {
                return ctx.replyV2({ description: 'No reactlocks set up in this server.', isAlert: true });
            }

            const lines = locks.map((l: any, i: number) => {
                const display = l.targetType === 'role' ? `<@&${l.targetId}>` : `<@${l.targetId}>`;
                const typeLabel = l.targetType === 'role' ? '(role)' : '(user)';
                return `**${i + 1}.** ${display} ${typeLabel} → ${l.emoji}`;
            });

            const embed = client.embed()
                .setTitle('React Locks')
                .setDescription(lines.join('\n'))
                .setColor(client.color.main)
                .setFooter({ text: `${locks.length}/20 reactlocks used` });

            return ctx.reply({ embeds: [embed] });
        }
    }
}
