import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { DiceRoller, RollResult } from '../../utils/DiceRoller';

export default class RepeatRoll extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'rr',
            description: {
                content: 'Roll a dice formula multiple times (iteration rolls).',
                usage: 'rr <iterations> <dice expression> [reason]',
                examples: [
                    'rr 4 d6+2',
                    'drr 6 1d20+5 Multiattack',
                    'rr 3 2d6+4 Greatsword Hits',
                    'rr 4 4d6kh3 Stat Generation'
                ]
            },
            category: 'utility',
            aliases: ['drr', 'repeatroll', 'multiroll'],
            cooldown: 2,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'iterations',
                    description: 'Number of times to roll (1 - 25)',
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                    min_value: 1,
                    max_value: 25
                },
                {
                    name: 'expression',
                    description: 'The dice formula to roll (e.g. d6+3, 1d20+5, 2d6)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Optional description or reason for this batch of rolls',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        // Delete user's trigger message if sent as a prefix text command
        if (!ctx.isInteraction && ctx.message?.deletable) {
            ctx.message.delete().catch(() => {});
        }

        let iterations = ctx.options?.getInteger?.('iterations');
        let expression = ctx.options?.getString?.('expression');
        let reason = ctx.options?.getString?.('reason');

        if (iterations === undefined || iterations === null) {
            if (!args.length) {
                return await ctx.sendMessage({
                    content: `<@${ctx.author.id}> ❌ Please specify the number of iterations and a dice formula.\n**Usage:** \`.rr <count> <dice>\` (e.g. \`.rr 4 d6+3\`)`
                });
            }

            const parsedCount = parseInt(args[0], 10);
            if (isNaN(parsedCount) || parsedCount < 1) {
                return await ctx.sendMessage({
                    content: `<@${ctx.author.id}> ❌ The first argument must be a valid number of rolls (1 - 25).\n**Example:** \`.rr 4 1d20+5\``
                });
            }

            iterations = Math.min(25, parsedCount);
            if (args.length > 1) {
                expression = args[1];
                if (args.length > 2) {
                    reason = args.slice(2).join(' ');
                }
            } else {
                expression = '1d20';
            }
        }

        if (!expression) {
            expression = '1d20';
        }

        const results: RollResult[] = DiceRoller.repeatRoll(iterations, expression);

        const lines: string[] = [];
        let grandTotal = 0;
        let nat20Count = 0;
        let nat1Count = 0;

        results.forEach((res, index) => {
            grandTotal += res.total;
            let tag = '';
            if (res.hasD20) {
                if (res.isNat20) {
                    tag = ' 💥 *(Nat 20!)*';
                    nat20Count++;
                } else if (res.isNat1) {
                    tag = ' 💀 *(Nat 1!)*';
                    nat1Count++;
                }
            }

            lines.push(`**#${index + 1}:** ${res.breakdown} ➔ **${res.total}**${tag}`);
        });

        const avg = (grandTotal / results.length).toFixed(1);
        const reasonHeader = reason ? ` *(${reason})*` : '';

        let summaryText = `\n**Total:** ${grandTotal} • **Average:** ${avg}`;
        if (nat20Count > 0 || nat1Count > 0) {
            summaryText += ` • Crits: ${nat20Count}x Nat 20 | ${nat1Count}x Nat 1`;
        }

        const content = `<@${ctx.author.id}> 🎲${reasonHeader}\n${lines.join('\n')}${summaryText}`;

        return await ctx.sendMessage({
            content,
            allowedMentions: { users: [ctx.author.id] }
        });
    }
}
