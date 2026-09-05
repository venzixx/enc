import { PermissionFlagsBits, TextChannel, Message, Collection, AttachmentBuilder, User } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType } from '../../utils/AuditLogger';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Purge extends Command {
    public static activePurges = new Set<string>();
    public static cancelledChannels = new Set<string>();

    constructor(client: ExtendedClient) {
        super(client, {
            name: 'purge',
            description: {
                content: 'Bulk delete messages with advanced filters.',
                usage: 'purge [amount] [filter]',
                examples: ['purge 10', 'purge 50 bots', 'purge all', 'purge @user', 'purge stop']
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
                    description: 'Number of messages to scan, "all", or "stop" (Default: 100)',
                    type: 3, // STRING to accept int, 'all', or 'stop'
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
        const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };

        // 1. Parse Arguments (Hybrid Slash/Prefix)
        let amountInput = '';
        let filterInput = 'all';
        let targetUser: User | null = null;

        if (ctx.interaction) {
            amountInput = ctx.options.getString('amount') || '';
            filterInput = ctx.options.getString('filter') || 'all';
            targetUser = ctx.options.getUser('user');
        } else {
            for (const arg of args) {
                const lowerArg = arg.toLowerCase();

                if (lowerArg === 'stop') {
                    amountInput = 'stop';
                    continue;
                }

                const userId = arg.replace(/[<@!>]/g, '');
                if (/^\d{17,19}$/.test(userId)) {
                    targetUser = await client.users.fetch(userId).catch(() => null);
                    continue;
                }

                const filters = ['humans', 'bots', 'images', 'embeds', 'links'];
                if (filters.includes(lowerArg)) {
                    filterInput = lowerArg;
                    continue;
                }

                if (/^\d+$/.test(arg)) {
                    amountInput = arg;
                    continue;
                }

                if (lowerArg === 'all') {
                    if (!amountInput) {
                        amountInput = 'all';
                    } else {
                        filterInput = 'all';
                    }
                    continue;
                }
            }
        }

        if (!amountInput) amountInput = '100';

        // ===== HANDLE STOP =====
        if (amountInput.toLowerCase() === 'stop') {
            const channelId = ctx.channel.id;
            if (Purge.activePurges.has(channelId)) {
                Purge.cancelledChannels.add(channelId);
                return ctx.replyV2({
                    title: '🛑 Stopping Purge',
                    description: 'Stopping the active purge in this channel. It will stop after the current batch.',
                    borderless: true,
                    color: null,
                    allowedMentions
                });
            } else {
                return ctx.replyV2({
                    title: 'No Active Purge',
                    description: 'There is no active purge running in this channel.',
                    borderless: true,
                    color: null,
                    isAlert: true,
                    allowedMentions
                });
            }
        }

        const isAll = amountInput.toLowerCase() === 'all';
        const targetDeleteCount = isAll ? 10000 : parseInt(amountInput);

        if (isNaN(targetDeleteCount) || targetDeleteCount <= 0) {
            return ctx.replyV2({
                title: 'Invalid Amount',
                description: 'Please provide a valid number of messages to delete.',
                borderless: true,
                color: null,
                isAlert: true,
                allowedMentions
            });
        }

        const force = args.includes('--force') || args.includes('-f');
        if (isAll || targetDeleteCount > 50) {
            const confirmed = await ModConfirmation.ask({
                client,
                ctx,
                actionName: isAll ? 'Purge ALL Messages' : `Purge ${targetDeleteCount} Messages`,
                targetName: `#${(ctx.channel as any).name}`,
                dangerLevel: 'danger',
                details: isAll
                    ? 'Scan and delete up to 10,000 messages in this channel (under 14 days old).'
                    : `Scan and delete up to ${targetDeleteCount} messages matching filter "${filterInput}"${targetUser ? ` from ${targetUser.tag}` : ''}.`,
                confirmLabel: isAll ? 'Confirm Bulk Purge' : 'Confirm Purge',
                confirmEmoji: '🧹',
                force
            });

            if (!confirmed) return;
        }

        await ctx.deferReply(true);

        const channel = ctx.channel as TextChannel;
        let toDelete: Message[] = [];
        let deletedMessages: any[] = [];
        let lastId: string | undefined;
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        let scanned = 0;
        const maxCollect = targetDeleteCount;
        const maxScanned = isAll ? 10000 : Math.max(targetDeleteCount * 3, 2000);
        let fetchError: any = null;
        const deletePromises: Promise<any>[] = [];

        // Fetch and Pipelined Delete Loop
        Purge.activePurges.add(channel.id);
        try {
            while (scanned < maxScanned && deletedMessages.length + toDelete.length < maxCollect) {
                if (Purge.cancelledChannels.has(channel.id)) {
                    console.log(`[Purge] Stopped in channel ${channel.id} by user request.`);
                    break;
                }

                const fetchLimit = Math.min(100, maxScanned - scanned, maxCollect - (deletedMessages.length + toDelete.length));
                if (fetchLimit <= 0) break;

                const messages: Collection<string, Message> | null = await channel.messages.fetch({ limit: fetchLimit, before: lastId }).catch(err => {
                    fetchError = err;
                    return null;
                });
                
                if (!messages || messages.size === 0) break;
                
                lastId = messages.last()?.id;
                scanned += messages.size;

                const filtered = messages.filter(msg => {
                    if (msg.createdTimestamp < twoWeeksAgo) return false;
                    if (targetUser && msg.author.id !== targetUser.id) return false;

                    switch (filterInput) {
                        case 'humans': return !msg.author.bot;
                        case 'bots': return msg.author.bot;
                        case 'images': return msg.attachments.size > 0;
                        case 'embeds': return msg.embeds.length > 0;
                        case 'links': return /https?:\/\//.test(msg.content);
                        default: return true;
                    }
                });

                for (const msg of filtered.values()) {
                    toDelete.push(msg);
                }

                while (toDelete.length >= 100) {
                    const chunk = toDelete.splice(0, 100);
                    const chunkCollection = new Collection<string, Message>();
                    for (const m of chunk) {
                        chunkCollection.set(m.id, m);
                    }

                    const p = channel.bulkDelete(chunkCollection, true)
                        .then(deleted => {
                            deletedMessages.push(...deleted.values());
                        })
                        .catch(err => {
                            console.error('[Purge Background Bulk Delete Error]', err);
                        });
                    deletePromises.push(p);
                }

                if (messages.last() && messages.last()!.createdTimestamp < twoWeeksAgo) break;
                if (messages.size < 100) break;
            }

            if (toDelete.length > 0) {
                if (toDelete.length === 1) {
                    const msg = toDelete[0];
                    const p = msg.delete()
                        .then(() => {
                            deletedMessages.push(msg);
                        })
                        .catch(err => {
                            console.error('[Purge Background Single Delete Error]', err);
                        });
                    deletePromises.push(p);
                } else {
                    const chunkCollection = new Collection<string, Message>();
                    for (const m of toDelete) {
                        chunkCollection.set(m.id, m);
                    }
                    const p = channel.bulkDelete(chunkCollection, true)
                        .then(deleted => {
                            deletedMessages.push(...deleted.values());
                        })
                        .catch(err => {
                            console.error('[Purge Background Bulk Delete Error]', err);
                        });
                    deletePromises.push(p);
                }
                toDelete = [];
            }

            await Promise.all(deletePromises);
        } finally {
            Purge.activePurges.delete(channel.id);
            Purge.cancelledChannels.delete(channel.id);
        }

        if (deletedMessages.length === 0) {
            let description = 'No eligible messages found matching your criteria.\n(Note: Messages must be under 14 days old).';
            if (fetchError) {
                if (fetchError.code === 50013) {
                    description = 'Failed to fetch messages: Missing "Read Message History" or "View Channel" permissions.';
                } else {
                    description = `Failed to fetch messages: ${fetchError.message || fetchError}`;
                }
            }
            return ctx.replyV2({
                title: 'No Messages Found',
                description,
                borderless: true,
                color: null,
                isAlert: true,
                allowedMentions
            });
        }

        deletedMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        const transcript = deletedMessages.map(m => {
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
            details: `Purged ${deletedMessages.length} messages.\nTarget: ${targetUser ? targetUser.tag : filterInput}`,
            color: client.color.red,
            transcript: transcript,
            files: [attachment]
        });

        const replyPayload = await ctx.replyV2({
            title: `${client.emoji.success} Purge Complete`,
            description: `Successfully deleted **${deletedMessages.length}** message(s).`,
            borderless: true,
            color: null,
            allowedMentions
        });

        setTimeout(() => {
            if (ctx.interaction) ctx.interaction.deleteReply().catch(() => null);
            else if (replyPayload && typeof (replyPayload as any).delete === 'function') (replyPayload as any).delete().catch(() => null);
        }, 5000);
    }
}
