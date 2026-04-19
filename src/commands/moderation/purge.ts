import { PermissionFlagsBits, TextChannel, Message, Collection, AttachmentBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../../utils/AuditLogger';

export default class Purge extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'purge',
            description: {
                content: 'Bulk delete messages with advanced filters.',
                usage: 'purge [amount] [filter]',
                examples: ['purge 10', 'purge 50 bots', 'purge all', 'purge @user']
            },
            category: 'moderation',
            cooldown: 5,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ManageMessages],
                client: [PermissionFlagsBits.ManageMessages]
            },
            options: [
                {
                    name: 'amount',
                    description: 'Number of messages to scan or "all" (Default: 100)',
                    type: 3, // STRING to accept int or 'all'
                    required: false
                },
                {
                    name: 'filter',
                    description: 'Filter what to delete',
                    type: 3,
                    choices: [
                        { name: 'None (All)', value: 'all' },
                        { name: 'Humans', value: 'humans' },
                        { name: 'Bots', value: 'bots' },
                        { name: 'Images/Attachments', value: 'images' },
                        { name: 'Embeds', value: 'embeds' },
                        { name: 'Links', value: 'links' }
                    ],
                    required: false
                },
                {
                    name: 'user',
                    description: 'Purge messages from a specific user',
                    type: 6, // USER
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply(true);

        // 1. Parse Arguments (Hybrid Slash/Prefix)
        let amountInput = ctx.options.getString('amount') || '';
        let filterInput = ctx.options.getString('filter') || 'all';
        let targetUser = ctx.options.getUser('user');

        // Prefix Command Fallback logic
        if (!amountInput && !targetUser && args.length > 0) {
            for (const arg of args) {
                // Check for user mention/ID
                const userId = arg.replace(/[<@!>]/g, '');
                if (/^\d{17,19}$/.test(userId)) {
                    targetUser = await client.users.fetch(userId).catch(() => null);
                    continue;
                }

                // Check for filter keywords
                const filters = ['humans', 'bots', 'images', 'embeds', 'links', 'all'];
                if (filters.includes(arg.toLowerCase())) {
                    filterInput = arg.toLowerCase();
                    continue;
                }

                // Check for amount
                if (/^\d+$/.test(arg) || arg.toLowerCase() === 'all') {
                    amountInput = arg;
                    continue;
                }
            }
        }

        // Final normalization
        if (!amountInput) amountInput = '100';
        const isAll = amountInput.toLowerCase() === 'all';
        const targetDeleteCount = isAll ? 1000 : parseInt(amountInput);
        
        if (isNaN(targetDeleteCount) || targetDeleteCount <= 0) {
            return ctx.editReply({ embeds: [client.embed({ title: 'Invalid Amount', description: 'Please provide a valid number of messages to delete.', color: client.color.red }, ctx)] });
        }

        const channel = ctx.channel as TextChannel;
        let toDelete: Collection<string, Message> = new Collection();
        let scannedCount = 0;
        const scanMax = 1000;
        let lastId: string | undefined;
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

        // 2. Deep Scan Loop
        while (toDelete.size < targetDeleteCount && scannedCount < scanMax) {
            const fetchLimit = Math.min(100, scanMax - scannedCount);
            const messages: Collection<string, Message> | null = await channel.messages.fetch({ limit: fetchLimit, before: lastId }).catch(() => null);
            
            if (!messages || messages.size === 0) break;
            
            scannedCount += messages.size;
            lastId = messages.last()?.id;

            const filtered = messages.filter(msg => {
                // Safety: Discord Bulk Delete Limit (14 days)
                if (msg.createdTimestamp < twoWeeksAgo) return false;

                // User Filter
                if (targetUser && msg.author.id !== targetUser.id) return false;

                // Category Filter
                switch (filterInput) {
                    case 'humans': return !msg.author.bot;
                    case 'bots': return msg.author.bot;
                    case 'images': return msg.attachments.size > 0;
                    case 'embeds': return msg.embeds.length > 0;
                    case 'links': return /https?:\/\//.test(msg.content);
                    default: return true;
                }
            });

            // Add to deletion pool
            for (const [id, msg] of filtered) {
                if (toDelete.size >= targetDeleteCount) break;
                toDelete.set(id, msg);
            }

            // Optimization: If the last message in this batch is older than 14 days, stop scanning
            if (messages.last() && messages.last()!.createdTimestamp < twoWeeksAgo) break;
        }

        // 3. Execution
        if (toDelete.size === 0) {
            return ctx.editReply({ 
                embeds: [client.embed({ 
                    title: ' No Messages Found', 
                    description: `No eligible messages found matching your criteria in the last **${scannedCount}** messages scanned.\n(Note: Messages must be under 14 days old).`, 
                    color: client.color.yellow 
                }, ctx)]
            });
        }

        const deleted = await channel.bulkDelete(toDelete, true).catch(err => {
            console.error('[Purge Error]', err);
            return null;
        });

        if (!deleted) {
             return ctx.editReply({ 
                embeds: [client.embed({ title: ' Purge Failed', description: 'Failed to delete messages. They might be too old (> 14 days) or already deleted.', color: client.color.red }, ctx)]
            });
        }

        // Generate Transcript
        const transcript = deleted.map(m => {
            if (!m) return '[Unknown Message]';
            const time = new Date(m.createdTimestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
            return `[${time}] [${m.author?.tag || 'Unknown'}] (${m.author?.id || 'Unknown'}): ${m.content || (m.attachments.size > 0 ? '[Attachment]' : '[No Content]')}`;
        }).reverse().join('\n');

        const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `purge-${channel.id}-${Date.now()}.txt` });

        await AuditLogger.log(client, ctx.guild, {
            type: AuditLogType.MODERATION,
            event: 'Purged Messages',
            executorId: ctx.author.id,
            executorTag: ctx.author.tag,
            targetId: channel.id,
            targetName: channel.name,
            details: `Purged ${deleted.size} messages.\nTarget: ${targetUser ? targetUser.tag : filterInput}\nScanned: ${scannedCount} messages.`,
            color: client.color.red,
            transcript: transcript,
            files: [attachment]
        });

        const replyMessage = await ctx.editReply({ 
            embeds: [client.embed({ 
                title: `${client.emoji.success} Purge Complete`, 
                description: `Successfully wiped **${deleted.size}** messages after scanning **${scannedCount}** messages.`, 
                color: client.color.main 
            }, ctx)]
        });

        // Optional: Auto-delete the success message after 5 seconds
        setTimeout(() => {
            if (ctx.interaction) ctx.interaction.deleteReply().catch(() => null);
            else if (replyMessage instanceof Message) replyMessage.delete().catch(() => null);
        }, 5000);
    }
}
