import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import ms from 'ms';

function extractMessageId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();
    // Check if it's a message link
    if (clean.includes('discord.com/channels/') || clean.includes('discordapp.com/channels/')) {
        const parts = clean.split('/');
        const last = parts[parts.length - 1];
        if (/^\d{17,20}$/.test(last)) {
            return last;
        }
    }
    // If it's a raw message ID
    if (/^\d{17,20}$/.test(clean)) {
        return clean;
    }
    return null;
}

export default class TimeDiff extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'timediff',
            description: {
                content: 'Shows the time difference between two message links or IDs.',
                usage: 'timediff <msg1_link_or_id> <msg2_link_or_id>',
                examples: ['timediff https://discord.com/channels/.../.../105822 https://discord.com/channels/.../.../105823']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: [
                {
                    name: 'msg1',
                    description: 'First message link or ID',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'msg2',
                    description: 'Second message link or ID',
                    type: 3, // STRING
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        const val1 = ctx.options.getString('msg1') || _args[0];
        const val2 = ctx.options.getString('msg2') || _args[1];

        if (!val1 || !val2) {
            return ctx.replyV2({ description: 'Please provide two message links or message IDs.\n**Usage:** `timediff <msg1_link_or_id> <msg2_link_or_id>`', color: client.color.red, isAlert: true, ephemeral: true });
        }

        const msg1 = extractMessageId(val1);
        const msg2 = extractMessageId(val2);

        if (!msg1 || !msg2) {
            return ctx.replyV2({ description: 'Could not extract valid message IDs. Please provide valid message links or message IDs.', color: client.color.red, isAlert: true, ephemeral: true });
        }

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
            return ctx.replyV2({ description: 'Invalid Message IDs or links provided.', color: client.color.red, isAlert: true, ephemeral: true });
        }
    }
}
