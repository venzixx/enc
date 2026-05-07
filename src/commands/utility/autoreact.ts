import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

// Regex to match Discord custom emoji (<:name:id> or <a:name:id>) or common unicode emojis
const EMOJI_REGEX = /(<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{200D}]|[\u{20E3}]|[\u{FE0F}])+/u;

export default class AutoReact extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'autoreact',
            aliases: ['ar'],
            description: {
                content: 'Automatically react to messages containing a phrase or mention.',
                usage: 'autoreact <add/remove/list> [trigger] [emoji]',
                examples: ['autoreact add hello 👋', 'autoreact add @User ❤️', 'autoreact remove hello 👋', 'autoreact list']
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
                    description: 'Add an autoreact trigger',
                    type: 1,
                    options: [
                        {
                            name: 'trigger',
                            description: 'The phrase or @mention to react to',
                            type: 3,
                            required: true
                        },
                        {
                            name: 'emoji',
                            description: 'The emoji to react with',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove an autoreact trigger',
                    type: 1,
                    options: [
                        {
                            name: 'trigger',
                            description: 'The phrase or @mention to stop reacting to',
                            type: 3,
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
                    description: 'List all autoreact triggers',
                    type: 1
                }
            ]
        });
    }

    /**
     * Parse trigger and emoji from raw message content for prefix commands.
     * Format: ,autoreact add <trigger> <emoji>
     * The emoji is always the LAST token (custom emoji or unicode).
     * The trigger is everything between the subcommand and the emoji.
     */
    private parsePrefixArgs(ctx: Context): { trigger: string; emoji: string } | null {
        const msg = ctx.message;
        if (!msg) return null;

        const content = msg.content;
        // Find where the subcommand args begin after "autoreact <sub>"
        // Match: prefix + autoreact/ar + add/remove + <rest>
        const match = content.match(/(?:autoreact|ar)\s+(add|remove|list)\s+([\s\S]+)/i);
        if (!match) return null;

        const rawArgs = match[2].trim();
        if (!rawArgs) return null;

        // Try to find a custom Discord emoji at the end: <:name:id> or <a:name:id>
        const customEmojiMatch = rawArgs.match(/(<a?:\w+:\d+>)\s*$/);
        if (customEmojiMatch) {
            const emoji = customEmojiMatch[1];
            const trigger = rawArgs.slice(0, customEmojiMatch.index).trim();
            if (trigger && emoji) return { trigger, emoji };
        }

        // Try to find a unicode emoji at the end
        // Split by whitespace, last token is the emoji candidate
        const parts = rawArgs.split(/\s+/);
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1];
            // Check if it looks like a unicode emoji (not a mention, not alphanumeric)
            if (EMOJI_REGEX.test(lastPart) && !lastPart.startsWith('<@') && !lastPart.startsWith('<#')) {
                const emoji = lastPart;
                const trigger = parts.slice(0, -1).join(' ');
                if (trigger && emoji) return { trigger, emoji };
            }
        }

        return null;
    }

    /**
     * Normalize a trigger for storage:
     * - Mentions (<@123> or <@!123>) → store raw user ID
     * - Phrases → store lowercase
     */
    private normalizeTrigger(trigger: string): { stored: string; display: string; isMention: boolean } {
        const mentionMatch = trigger.match(/^<@!?(\d{17,20})>$/);
        if (mentionMatch) {
            return {
                stored: mentionMatch[1],
                display: `<@${mentionMatch[1]}>`,
                isMention: true
            };
        }
        return {
            stored: trigger.toLowerCase(),
            display: `\`${trigger}\``,
            isMention: false
        };
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Determine subcommand
        let sub: string | null = null;
        try { sub = ctx.options.getSubcommand(); } catch { /* prefix command */ }
        if (!sub) sub = args[0]?.toLowerCase() || null;

        if (!sub || !['add', 'remove', 'list'].includes(sub)) {
            return ctx.replyV2({ description: 'Invalid subcommand. Use `add`, `remove`, or `list`.', isAlert: true });
        }

        if (sub === 'add') {
            // Get trigger & emoji from slash command options or prefix raw content
            let trigger = ctx.interaction ? ctx.options.getString('trigger') : null;
            let emoji = ctx.interaction ? ctx.options.getString('emoji') : null;

            if (!trigger || !emoji) {
                const parsed = this.parsePrefixArgs(ctx);
                if (parsed) {
                    trigger = parsed.trigger;
                    emoji = parsed.emoji;
                }
            }

            if (!trigger || !emoji) {
                return ctx.replyV2({ description: 'Please provide both a trigger and an emoji.\n**Usage:** `autoreact add <word/@mention> <emoji>`', isAlert: true });
            }

            const { stored: storedTrigger, display: displayTrigger } = this.normalizeTrigger(trigger);

            // For custom emojis, extract the ID for reacting (Discord API needs just the name:id or the full <:name:id>)
            // Validate the emoji works by checking format
            const isCustomEmoji = /^<a?:\w+:\d+>$/.test(emoji);
            const isUnicodeEmoji = EMOJI_REGEX.test(emoji);
            if (!isCustomEmoji && !isUnicodeEmoji) {
                return ctx.replyV2({ description: `\`${emoji}\` is not a valid emoji.`, isAlert: true });
            }

            // Check limit (max 20 per guild)
            const count = await (client.prisma as any).autoReact.count({
                where: { guildId: ctx.guild.id }
            });

            if (count >= 20) {
                return ctx.replyV2({ description: 'You can only have up to **20** autoreact triggers per server.', isAlert: true });
            }

            // Check if this exact trigger+emoji already exists
            const existing = await (client.prisma as any).autoReact.findUnique({
                where: { guildId_trigger_emoji: { guildId: ctx.guild.id, trigger: storedTrigger, emoji } }
            });

            if (existing) {
                return ctx.replyV2({ description: 'This autoreact trigger already exists.', isAlert: true });
            }

            await (client.prisma as any).autoReact.create({
                data: {
                    guildId: ctx.guild.id,
                    trigger: storedTrigger,
                    emoji
                }
            });

            const embed = client.embed()
                .setTitle('Auto React Added')
                .setDescription(`Messages containing ${displayTrigger} will now get a ${emoji} reaction.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        } else if (sub === 'remove') {
            let trigger = ctx.interaction ? ctx.options.getString('trigger') : null;
            let emoji = ctx.interaction ? ctx.options.getString('emoji') : null;

            if (!trigger || !emoji) {
                const parsed = this.parsePrefixArgs(ctx);
                if (parsed) {
                    trigger = parsed.trigger;
                    emoji = parsed.emoji;
                }
            }

            if (!trigger || !emoji) {
                return ctx.replyV2({ description: 'Please provide both the trigger and emoji to remove.\n**Usage:** `autoreact remove <word/@mention> <emoji>`', isAlert: true });
            }

            const { stored: storedTrigger } = this.normalizeTrigger(trigger);

            const deleted = await (client.prisma as any).autoReact.deleteMany({
                where: { guildId: ctx.guild.id, trigger: storedTrigger, emoji }
            });

            if (deleted.count === 0) {
                // Also try matching without normalization (legacy data)
                const deletedLegacy = await (client.prisma as any).autoReact.deleteMany({
                    where: { guildId: ctx.guild.id, trigger: trigger.toLowerCase(), emoji }
                });
                if (deletedLegacy.count === 0) {
                    return ctx.replyV2({ description: 'No matching autoreact trigger found.', isAlert: true });
                }
            }

            const embed = client.embed()
                .setTitle('Auto React Removed')
                .setDescription(`Removed ${emoji} reaction for **${trigger}**.`)
                .setColor(client.color.main);

            return ctx.reply({ embeds: [embed] });

        } else if (sub === 'list') {
            const triggers = await (client.prisma as any).autoReact.findMany({
                where: { guildId: ctx.guild.id }
            });

            if (triggers.length === 0) {
                return ctx.replyV2({ description: 'No autoreact triggers set up in this server.', isAlert: true });
            }

            const lines = triggers.map((t: any, i: number) => {
                const isUserId = /^\d{17,20}$/.test(t.trigger);
                const display = isUserId ? `<@${t.trigger}>` : `\`${t.trigger}\``;
                return `**${i + 1}.** ${display} → ${t.emoji}`;
            });

            const embed = client.embed()
                .setTitle('Auto React Triggers')
                .setDescription(lines.join('\n'))
                .setColor(client.color.main)
                .setFooter({ text: `${triggers.length}/20 triggers used` });

            return ctx.reply({ embeds: [embed] });
        }
    }
}
