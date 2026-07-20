import { PermissionFlagsBits, TextChannel, Message, Collection, AttachmentBuilder, User, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { AuditLogger, AuditLogType, AuditLogStatus } from '../../utils/AuditLogger';

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
        // 1. Parse Arguments (Hybrid Slash/Prefix)
        let amountInput = '';
        let filterInput = 'all';
        let targetUser: User | null = null;

        if (ctx.interaction) {
            amountInput = ctx.options.getString('amount') || '';
            filterInput = ctx.options.getString('filter') || 'all';
            targetUser = ctx.options.getUser('user');
        } else {
            // Robust prefix arguments parsing
            for (const arg of args) {
                const lowerArg = arg.toLowerCase();

                // Check for 'stop' keyword
                if (lowerArg === 'stop') {
                    amountInput = 'stop';
                    continue;
                }

                // Check for user mention/ID
                const userId = arg.replace(/[<@!>]/g, '');
                if (/^\d{17,19}$/.test(userId)) {
                    targetUser = await client.users.fetch(userId).catch(() => null);
                    continue;
                }

                // Check for filter keywords (excluding 'all' to avoid overlap with amount)
                const filters = ['humans', 'bots', 'images', 'embeds', 'links'];
                if (filters.includes(lowerArg)) {
                    filterInput = lowerArg;
                    continue;
                }

                // Check for amount (numbers)
                if (/^\d+$/.test(arg)) {
                    amountInput = arg;
                    continue;
                }

                // Check for 'all' keyword
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

        // Final normalization
        if (!amountInput) amountInput = '100';

        // ===== HANDLE STOP =====
        if (amountInput.toLowerCase() === 'stop') {
            const channelId = ctx.channel.id;
            if (Purge.activePurges.has(channelId)) {
                Purge.cancelledChannels.add(channelId);
                const stopEmbed = client.embed({
                    title: '🛑 Stopping Purge',
                    description: 'Stopping the active purge in this channel. It will stop after the current batch.',
                    color: client.color.yellow
                }, ctx);
                if (ctx.interaction) {
                    await ctx.deferReply(true);
                    return ctx.editReply({ embeds: [stopEmbed] });
                } else {
                    return ctx.sendMessage({ embeds: [stopEmbed] });
                }
            } else {
                const noActiveEmbed = client.embed({
                    title: 'No Active Purge',
                    description: 'There is no active purge running in this channel.',
                    color: client.color.red
                }, ctx);
                if (ctx.interaction) {
                    await ctx.deferReply(true);
                    return ctx.editReply({ embeds: [noActiveEmbed] });
                } else {
                    return ctx.sendMessage({ embeds: [noActiveEmbed] });
                }
            }
        }

        const isAll = amountInput.toLowerCase() === 'all';
        let progressMessage: Message | null = null;

        // ===== HANDLE ALL (CONFIRMATION) =====
        if (isAll) {
            if (ctx.interaction) {
                await ctx.deferReply(true);
            }

            const confirmEmbed = client.embed({
                title: '⚠️ Confirm Bulk Delete',
                description: `Are you sure you want to purge **ALL** messages in this channel?\nThis will scan and delete up to 10,000 messages (under 14 days old).`,
                color: client.color.yellow
            }, ctx);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_all_purge')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_all_purge')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            let confirmMsg: Message;
            if (ctx.interaction) {
                confirmMsg = await ctx.editReply({ embeds: [confirmEmbed], components: [row] }) as Message;
            } else {
                confirmMsg = await ctx.sendMessage({ embeds: [confirmEmbed], components: [row] }) as Message;
            }

            try {
                const interaction = await confirmMsg.awaitMessageComponent({
                    filter: i => i.user.id === ctx.author.id && (i.customId === 'confirm_all_purge' || i.customId === 'cancel_all_purge'),
                    time: 20000,
                    componentType: ComponentType.Button
                });

                if (interaction.customId === 'cancel_all_purge') {
                    const cancelEmbed = client.embed({
                        title: 'Purge Canceled',
                        description: 'The bulk purge operation was canceled.',
                        color: client.color.green
                    }, ctx);
                    await interaction.update({ embeds: [cancelEmbed], components: [] });
                    setTimeout(() => {
                        if (ctx.interaction) ctx.interaction.deleteReply().catch(() => null);
                        else confirmMsg.delete().catch(() => null);
                    }, 5000);
                    return;
                }

                // Confirmed
                const purgingEmbed = client.embed({
                    title: '🧹 Purging...',
                    description: 'Scanning and deleting messages, please wait...',
                    color: client.color.yellow
                }, ctx);
                await interaction.update({ embeds: [purgingEmbed], components: [] });
                progressMessage = confirmMsg;

            } catch (err) {
                // Timeout
                const timeoutEmbed = client.embed({
                    title: 'Purge Canceled',
                    description: 'No confirmation received within 20 seconds. Operation canceled.',
                    color: client.color.red
                }, ctx);
                if (ctx.interaction) {
                    await ctx.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
                } else {
                    await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
                }
                setTimeout(() => {
                    if (ctx.interaction) ctx.interaction.deleteReply().catch(() => null);
                    else confirmMsg.delete().catch(() => null);
                }, 5000);
                return;
            }
        } else {
            // Normal amount
            if (!ctx.interaction) {
                progressMessage = await ctx.sendMessage({ 
                    embeds: [client.embed({ 
                        title: '🧹 Purging...', 
                        description: 'Scanning and deleting messages, please wait...', 
                        color: client.color.yellow 
                    }, ctx)] 
                }) as Message;
            } else {
                await ctx.deferReply(true);
            }
        }

        const targetDeleteCount = isAll ? 10000 : parseInt(amountInput);
        
        if (isNaN(targetDeleteCount) || targetDeleteCount <= 0) {
            const errEmbed = client.embed({ 
                title: 'Invalid Amount', 
                description: 'Please provide a valid number of messages to delete.', 
                color: client.color.red 
            }, ctx);
            if (ctx.interaction) {
                return ctx.editReply({ embeds: [errEmbed] });
            } else if (progressMessage) {
                return progressMessage.edit({ embeds: [errEmbed] }).catch(() => null);
            } else {
                return ctx.sendMessage({ embeds: [errEmbed] });
            }
        }

        const channel = ctx.channel as TextChannel;
        let toDelete: Message[] = [];
        let deletedMessages: any[] = [];
        let lastId: string | undefined;
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        let scanned = 0;
        const maxCollect = targetDeleteCount;
        
        // Limit scanning to avoid heavy rate limits on sequential fetching.
        // For 'all' we scan up to 10000 messages (the max target).
        const maxScanned = isAll ? 10000 : Math.max(targetDeleteCount * 3, 2000);
        let fetchError: any = null;
        const deletePromises: Promise<any>[] = [];

        // 2. Fetch and Pipelined Delete Loop
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

                // Add filtered messages to toDelete queue
                for (const msg of filtered.values()) {
                    toDelete.push(msg);
                }

                // Pipelining: Whenever we have accumulated 100 messages, bulk delete them in the background
                while (toDelete.length >= 100) {
                    const chunk = toDelete.splice(0, 100);
                    const chunkCollection = new Collection<string, Message>();
                    for (const m of chunk) {
                        chunkCollection.set(m.id, m);
                    }

                    // Launch bulkDelete in the background (discord.js handles queueing, so we don't block fetching)
                    const p = channel.bulkDelete(chunkCollection, true)
                        .then(deleted => {
                            deletedMessages.push(...deleted.values());
                        })
                        .catch(err => {
                            console.error('[Purge Background Bulk Delete Error]', err);
                        });
                    deletePromises.push(p);
                }

                // Optimization: If the last message in this batch is older than 14 days, stop scanning
                if (messages.last() && messages.last()!.createdTimestamp < twoWeeksAgo) break;
                
                // If we fetched less than 100, we've reached the end of the channel
                if (messages.size < 100) break;
            }

            // Handle leftovers in toDelete
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

            // Wait for all background deletions to complete
            await Promise.all(deletePromises);
        } finally {
            Purge.activePurges.delete(channel.id);
            Purge.cancelledChannels.delete(channel.id);
        }

        // 3. Response Generation
        if (deletedMessages.length === 0) {
            let description = 'No eligible messages found matching your criteria.\n(Note: Messages must be under 14 days old).';
            if (fetchError) {
                if (fetchError.code === 50013) {
                    description = 'Failed to fetch messages: Missing "Read Message History" or "View Channel" permissions.';
                } else {
                    description = `Failed to fetch messages: ${fetchError.message || fetchError}`;
                }
            }
            const noMsgEmbed = client.embed({ 
                title: ' No Messages Found', 
                description: description, 
                color: client.color.yellow 
            }, ctx);
            if (ctx.interaction) {
                return ctx.editReply({ embeds: [noMsgEmbed] });
            } else if (progressMessage) {
                return progressMessage.edit({ embeds: [noMsgEmbed] }).catch(() => null);
            } else {
                return ctx.sendMessage({ embeds: [noMsgEmbed] });
            }
        }

        // Sort messages to preserve chronological order for the transcript
        deletedMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        // Generate Transcript
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

        const replyEmbed = client.embed({ 
            title: `${client.emoji.success} Purge Complete`, 
            description: `deleted **${deletedMessages.length}** messages`, 
            color: client.color.main 
        }, ctx);

        let finalReply: any;
        if (ctx.interaction) {
            finalReply = await ctx.editReply({ embeds: [replyEmbed] });
        } else if (progressMessage) {
            finalReply = await progressMessage.edit({ embeds: [replyEmbed] }).catch(() => null);
        } else {
            finalReply = await ctx.sendMessage({ embeds: [replyEmbed] });
        }

        // Optional: Auto-delete the success message after 5 seconds
        setTimeout(() => {
            if (ctx.interaction) ctx.interaction.deleteReply().catch(() => null);
            else if (finalReply instanceof Message) finalReply.delete().catch(() => null);
        }, 5000);
    }
}
