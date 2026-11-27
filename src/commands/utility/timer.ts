import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { PermissionFlagsBits } from 'discord.js';
import ms from 'ms';
import { TimerManager } from '../../utils/TimerManager';
import { V2Helper } from '../../utils/V2Helper';

export default class Timer extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timer',
            aliases: ['cd', 'countdown'],
            description: {
                content: 'Start, list, or cancel countdown timers.',
                usage: 'timer <duration> [reason] | timer list | timer remove <messageID>',
                examples: ['timer 10m study session', 'timer list', 'timer remove 123456789012345678']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'start',
                    description: 'Start a countdown timer',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'duration',
                            description: 'Timer duration (e.g., 10s, 5m, 1h)',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'reason',
                            description: 'Reason for the countdown',
                            type: 3, // STRING
                            required: false
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List active countdown timers in this server',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'remove',
                    description: 'Cancel an active countdown timer',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'message_id',
                            description: 'The Message ID of the timer to cancel',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ],
            // @ts-ignore - Support User Installable Apps with numeric fallbacks
            integration_types: [0, 1], // Guild & User
            // @ts-ignore
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let sub = '';
        let durationStr = '';
        let reason = '';
        let removeMsgId = '';

        if (ctx.interaction) {
            sub = ctx.options.getSubcommand();
            if (sub === 'start') {
                durationStr = ctx.options.getString('duration')!;
                reason = ctx.options.getString('reason') || '';
            } else if (sub === 'remove') {
                removeMsgId = ctx.options.getString('message_id')!;
            }
        } else {
            const firstArg = args[0]?.toLowerCase();
            if (firstArg === 'list') {
                sub = 'list';
            } else if (firstArg === 'remove') {
                sub = 'remove';
                removeMsgId = args[1] || '';
            } else {
                sub = 'start';
                if (firstArg === 'start') {
                    durationStr = args[1] || '';
                    reason = args.slice(2).join(' ');
                } else {
                    durationStr = args[0] || '';
                    reason = args.slice(1).join(' ');
                }
            }
        }

        // ===== START TIMER =====
        if (sub === 'start') {
            if (!durationStr) {
                return ctx.replyV2({ description: 'Please provide a valid duration (e.g., 10s, 5m, 1h).', isAlert: true });
            }

            const duration = ms(durationStr as any) as unknown as number;
            if (!duration || duration < 1000) {
                return ctx.replyV2({ description: 'Invalid duration provided. Minimum is 1 second (e.g., 10s, 5m, 1h).', isAlert: true });
            }

            if (duration > 86400000 * 7) { // 7 days limit
                return ctx.replyV2({ description: 'Timer duration cannot exceed 7 days.', isAlert: true });
            }

            const now = Date.now();
            const endTime = now + duration;
            const endUnix = Math.floor(endTime / 1000);

            // Send initial layout showing live countdown
            const reply = await ctx.replyV2({
                title: '⏱️ Timer Started',
                description: `Your **${durationStr}** timer will end <t:${endUnix}:R> (<t:${endUnix}:t>).${reason ? `\n> **Reason:** ${reason}` : ''}`,
                color: client.color.main
            });

            // Extract message ID
            let messageId = '';
            if (ctx.interaction) {
                try {
                    const fetched = await ctx.interaction.fetchReply();
                    messageId = fetched.id;
                } catch {}
            } else if (reply) {
                messageId = (reply as any).id;
            }

            if (!messageId) {
                messageId = `timer_${ctx.author.id}_${now}`;
            }

            // Register timer with persistent TimerManager
            TimerManager.addTimer({
                id: messageId,
                channelId: ctx.channel?.id || '',
                guildId: ctx.guild?.id || null,
                authorId: ctx.author.id,
                authorTag: ctx.author.tag || ctx.author.username,
                startTime: now,
                endTime,
                durationStr,
                reason
            });

            return;
        }

        // ===== LIST TIMERS =====
        if (sub === 'list') {
            const guildId = ctx.guild?.id || null;
            const guildTimers = TimerManager.getGuildTimers(guildId);

            if (guildTimers.length === 0) {
                return ctx.replyV2({ description: 'No active countdown timers running in this server.' });
            }

            const listLines = guildTimers.map((t, idx) => {
                const endUnix = Math.floor(t.endTime / 1000);
                return `**${idx + 1}.** ID: \`${t.id}\`\n> • **Author:** <@${t.authorId}> (${t.authorTag})\n> • **Ends:** <t:${endUnix}:R> (<t:${endUnix}:t>)\n> • **Reason:** ${t.reason || 'No reason provided'}`;
            });

            return ctx.replyV2({
                title: '⏱️ Active Timers',
                description: listLines.join('\n\n'),
                color: client.color.main
            });
        }

        // ===== REMOVE TIMER =====
        if (sub === 'remove') {
            if (!removeMsgId) {
                return ctx.replyV2({ description: 'Please provide the Message ID of the timer to cancel.', isAlert: true });
            }

            const timer = TimerManager.getTimer(removeMsgId);
            if (!timer) {
                return ctx.replyV2({ description: `No active timer found with Message ID \`${removeMsgId}\`.`, isAlert: true });
            }

            // Check authorization:
            // 1. Bot owner?
            const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
            const isBotOwner = BOT_OWNERS.has(ctx.author.id);
            // 2. Server admin?
            const isGuildAdmin = ctx.member?.permissions.has(PermissionFlagsBits.Administrator) || ctx.member?.permissions.has(PermissionFlagsBits.ManageGuild);
            // 3. Creator of the timer?
            const isCreator = timer.authorId === ctx.author.id;

            if (!isBotOwner && !isGuildAdmin && !isCreator) {
                return ctx.replyV2({
                    description: `${client.emoji.cross || '❌'} You do not have permission to remove this timer. Only administrators or the timer creator can cancel it.`,
                    isAlert: true
                });
            }

            // Cancel the timer
            TimerManager.removeTimer(removeMsgId);

            // Attempt to edit original message to reflect cancellation
            try {
                const channel = await client.channels.fetch(timer.channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const originalMsg = await (channel as any).messages.fetch(timer.id).catch(() => null);
                    if (originalMsg) {
                        const cancelLayout = V2Helper.createLayout({
                            title: '⏱️ Timer Cancelled',
                            description: `❌ The **${timer.durationStr}** timer was cancelled by <@${ctx.author.id}>.${timer.reason ? `\n> **Reason:** ${timer.reason}` : ''}`,
                            color: client.color.red || 0xef4444,
                            borderless: true
                        });
                        await originalMsg.edit(cancelLayout as any).catch(() => {});
                    }
                }
            } catch {}

            return ctx.replyV2({
                description: `${client.emoji.success || '✅'} Successfully cancelled the countdown timer with ID \`${removeMsgId}\`.`
            });
        }
    }
}
