import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import ms from 'ms';

interface TimerInstance {
    id: string; // Message ID
    channelId: string;
    guildId: string | null;
    authorId: string;
    authorTag: string;
    endTime: number; // Unix timestamp in seconds
    durationStr: string;
    reason: string;
    timeoutId: NodeJS.Timeout;
}

const runningTimers = new Map<string, TimerInstance>();

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
            cooldown: 5,
            slashCommand: true,
            options: [
                {
                    name: 'start',
                    description: 'Start a countdown timer',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'duration',
                            description: 'Timer duration (e.g., 10m, 1h)',
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
                return ctx.replyV2({ description: 'Please provide a valid duration (e.g., 5m, 1h).', isAlert: true });
            }

            const duration = ms(durationStr as any) as unknown as number;
            if (!duration || duration < 1000) {
                return ctx.replyV2({ description: 'Invalid duration provided. Minimum is 1 second.', isAlert: true });
            }

            if (duration > 86400000 * 7) { // 7 days limit
                return ctx.replyV2({ description: 'Timer duration cannot exceed 7 days.', isAlert: true });
            }

            const endTime = Math.floor((Date.now() + duration) / 1000);

            // Start with a V2 Card showing the live countdown
            const reply = await ctx.replyV2({
                title: 'Timer Started',
                description: `⏱️ Your **${durationStr}** timer will end <t:${endTime}:R>.${reason ? `\n**Reason:** ${reason}` : ''}`,
                color: client.color.main
            });

            let messageId = '';
            if (ctx.interaction) {
                try {
                    const fetched = await ctx.interaction.fetchReply();
                    messageId = fetched.id;
                } catch {}
            } else if (reply) {
                messageId = (reply as any).id;
            }

            // Set the timeout
            const timeoutId = setTimeout(async () => {
                try {
                    if (messageId) {
                        runningTimers.delete(messageId);
                    }
                    await ctx.followUp({
                        content: `🔔 ${ctx.author}, your **${durationStr}** timer has ended!${reason ? `\n**Reason:** ${reason}` : ''}`,
                    });
                } catch (e) {
                    // Silently fail if channel is inaccessible
                }
            }, duration);

            if (messageId) {
                runningTimers.set(messageId, {
                    id: messageId,
                    channelId: ctx.channel?.id || '',
                    guildId: ctx.guild?.id || null,
                    authorId: ctx.author.id,
                    authorTag: ctx.author.tag,
                    endTime,
                    durationStr,
                    reason,
                    timeoutId
                });
            }

            return;
        }

        // ===== LIST TIMERS =====
        if (sub === 'list') {
            const guildId = ctx.guild?.id || null;
            const guildTimers = Array.from(runningTimers.values()).filter(t => t.guildId === guildId);

            if (guildTimers.length === 0) {
                return ctx.replyV2({ description: 'No active countdown timers running in this server.' });
            }

            const embed = client.embed()
                .setTitle('Active Timers')
                .setColor(client.color.main);

            const listLines = guildTimers.map((t, idx) => {
                return `**${idx + 1}.** ID: \`${t.id}\`\n\u3000\u2022 **Author:** <@${t.authorId}> (${t.authorTag})\n\u3000\u2022 **Ends:** <t:${t.endTime}:R> (Duration: ${t.durationStr})\n\u3000\u2022 **Reason:** ${t.reason || 'No reason provided'}`;
            });

            embed.setDescription(listLines.join('\n\n'));
            return ctx.reply({ embeds: [embed] });
        }

        // ===== REMOVE TIMER =====
        if (sub === 'remove') {
            if (!removeMsgId) {
                return ctx.replyV2({ description: 'Please provide a valid Message ID of the timer to cancel.', isAlert: true });
            }

            const timer = runningTimers.get(removeMsgId);
            if (!timer) {
                return ctx.replyV2({ description: `No active timer found with Message ID \`${removeMsgId}\`.`, isAlert: true });
            }

            // Check authorization:
            // 1. Is bot owner?
            const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
            const isBotOwner = BOT_OWNERS.has(ctx.author.id);
            // 2. Is server administrator?
            const isGuildAdmin = ctx.member?.permissions.has(PermissionFlagsBits.Administrator) || ctx.member?.permissions.has(PermissionFlagsBits.ManageGuild);
            // 3. Is the creator of the timer?
            const isCreator = timer.authorId === ctx.author.id;

            if (!isBotOwner && !isGuildAdmin && !isCreator) {
                return ctx.replyV2({ description: `${client.emoji.cross} You do not have permission to remove this timer. Only administrators or the timer creator can cancel it.`, isAlert: true });
            }

            // Cancel the timer
            clearTimeout(timer.timeoutId);
            runningTimers.delete(removeMsgId);

            // Attempt to edit the original message to reflect cancellation
            try {
                const channel = await client.channels.fetch(timer.channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const originalMsg = await (channel as any).messages.fetch(timer.id).catch(() => null);
                    if (originalMsg) {
                        await originalMsg.edit({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Timer Cancelled')
                                    .setDescription(`⏱️ The **${timer.durationStr}** timer was cancelled by ${ctx.author.tag}.${timer.reason ? `\n**Reason:** ${timer.reason}` : ''}`)
                                    .setColor(0xFF0000)
                            ],
                            components: []
                        });
                    }
                }
            } catch {}

            return ctx.replyV2({ description: `${client.emoji.success} Successfully cancelled the countdown timer with ID \`${removeMsgId}\`.` });
        }
    }
}
