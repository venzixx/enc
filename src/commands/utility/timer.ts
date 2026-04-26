import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import ms from 'ms';

export default class Timer extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timer',
            aliases: ['cd', 'countdown'],
            description: {
                content: 'Start a synchronized channel-wide countdown timer.',
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
            args: true
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

        const embed = client.embed({
            title: `⏳ Timer Initialized`,
            description: `A synchronized countdown has been established by ${ctx.author}.\n\n**Duration:** \`${durationStr}\`\n**Remaining:** <t:${endTime}:R>`,
            color: client.color.main,
            footer: 'This timer is visible to all users in this channel.'
        }, ctx);

        const msg = await ctx.reply({ embeds: [embed] });

        // Wait for timer completion
        setTimeout(async () => {
            try {
                const finishEmbed = client.embed({
                    title: `⏰ Timer Expired`,
                    description: `The **${durationStr}** timer set by ${ctx.author} has concluded.`,
                    color: client.color.yellow,
                    footer: `Finality reached at <t:${endTime}:f>`
                }, ctx);

                // Send a new message to ping the user
                await ctx.channel.send({
                    content: `${client.emoji.clock} ${ctx.author}, your countdown is complete!`,
                    embeds: [finishEmbed]
                });
            } catch (e) {
                // Channel might be deleted or bot lost perms
            }
        }, duration);
    }
}
