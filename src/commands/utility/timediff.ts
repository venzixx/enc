import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import ms from 'ms';

export default class TimeDiff extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timediff',
            description: {
                content: 'Shows the time difference between two message IDs.',
                usage: 'timediff <m1_id> <m2_id>',
                examples: ['timediff 1058229418656116818 1058229418656116828']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'm1_id',
                    description: 'First message ID',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'm2_id',
                    description: 'Second message ID',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const msg1 = ctx.options.getString('m1_id')!;
        const msg2 = ctx.options.getString('m2_id')!;

        try {
            const time1 = Number(BigInt(msg1) >> 22n) + 1420070400000;
            const time2 = Number(BigInt(msg2) >> 22n) + 1420070400000;

            const diffMs = Math.abs(time2 - time1);

            return ctx.replyV2({
                title: `⏳ Message Time Difference`,
                description: `**Message 1:** <t:${Math.floor(time1 / 1000)}:T>\n**Message 2:** <t:${Math.floor(time2 / 1000)}:T>\n\n**Difference:** ${ms(diffMs, { long: true })}`,
                color: client.color.main,
                ephemeral: true
            });
        } catch (e) {
            return ctx.replyV2({ description: 'Invalid Message IDs provided.', color: client.color.red, isAlert: true, ephemeral: true });
        }
    }
}
