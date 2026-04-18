import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import ms from 'ms';

export default class Timer extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timer',
            description: {
                content: 'Set a DM timer.',
                usage: 'timer <duration>',
                examples: ['timer 30m']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'duration',
                    description: 'Duration for the timer (e.g. 10m, 1h)',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const durationStr = ctx.options.getString('duration')!;
        const duration = ms(durationStr) as any;

        if (!duration || duration < 1000) {
            return ctx.replyV2({ description: 'Invalid duration provided.', color: client.color.red, isAlert: true, ephemeral: true });
        }

        const endTime = Math.floor((Date.now() + duration) / 1000);

        try {
            await ctx.author.send({
                embeds: [
                    client.embed({
                        title: '🕒 Timer Started',
                        description: `Your timer for **${durationStr}** has started.\n\nEnds: <t:${endTime}:R>`,
                        color: client.color.main
                    }, ctx)
                ]
            });
            
            await ctx.replyV2({ description: `Timer set for **${durationStr}**. I will DM you when it's done!`, color: client.color.main, isAlert: true, ephemeral: true });
        } catch (e) {
            return ctx.replyV2({ description: 'I cannot DM you. Please open your DMs to set a timer.', color: client.color.red, isAlert: true, ephemeral: true });
        }

        setTimeout(async () => {
            try {
                await ctx.author.send({
                    content: `${ctx.author}`,
                    embeds: [
                        client.embed({
                            title: '⏰ Timer Finished!',
                            description: `Your **${durationStr}** timer has ended.`,
                            color: client.color.main
                        }, ctx)
                    ]
                });
            } catch (e) {
                // Ignore if closed
            }
        }, duration);
    }
}
