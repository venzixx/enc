import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import ms from 'ms';

export default class Timer extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timer',
            aliases: ['cd', 'countdown'],
            description: {
                content: 'Start a countdown timer.',
                usage: 'timer <duration>',
                examples: ['timer 10m', 'timer 1h']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            options: [
                {
                    name: 'duration',
                    description: 'Timer duration (e.g., 10m, 1h)',
                    type: 3, // STRING
                    required: true
                }
            ],
            args: true,
            // @ts-ignore - Support User Installable Apps with numeric fallbacks
            integration_types: [0, 1], // Guild & User
            // @ts-ignore
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const durationStr = ctx.options.getString('duration') || args[0];
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
        await ctx.replyV2({
            title: 'Timer Started',
            description: `⏱️ Your **${durationStr}** timer will end <t:${endTime}:R>.`,
            color: client.color.main
        });

        // Set the timer
        setTimeout(async () => {
            try {
                // For User Apps, we follow up with a notification
                await ctx.followUp({
                    content: `🔔 ${ctx.author}, your **${durationStr}** timer has ended!`,
                });
            } catch (e) {
                // Silently fail if channel is inaccessible
            }
        }, duration);
    }
}
