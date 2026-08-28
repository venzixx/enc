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
                content: 'Roll a dice formula multiple times (Avrae-style iteration rolls with automatic truncation).',
                usage: 'rr <iterations> <dice expression> [reason]',
                examples: [
                    'rr 4 d6+2',
                    'rr 30 20d100',
                    'drr 6 1d20 + 5 Multiattack',
                    'rr 3 2d6 + 4 Greatsword Hits',
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
                    description: 'Number of times to roll (1 - 30)',
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                    min_value: 1,
                    max_value: 30
                },
                {
                    name: 'expression',
                    description: 'The dice formula to roll (e.g. d20 + 6, 20d100, 2d6+3)',
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
                    content: `<@${ctx.author.id}> ❌ The first argument must be a valid number of rolls (1 - 30).\n**Example:** \`.rr 4 1d20+5\``
                });
            }

            iterations = Math.min(30, parsedCount);

            if (args.length > 1) {
                const parsed = DiceRoller.parseInput(args.slice(1));
                expression = parsed.expression;
                reason = parsed.reason;
            } else {
                expression = '1d20';
            }
        }

        if (!expression) {
            expression = '1d20';
        }

        const results: RollResult[] = DiceRoller.repeatRoll(iterations, expression);
        const grandTotal = results.reduce((acc, curr) => acc + curr.total, 0);
        const reasonHeader = reason ? ` *(${reason})*` : '';

        const header = `<@${ctx.author.id}>\nRolling ${results.length} iterations...${reasonHeader}\n`;
        const footer = `\n${grandTotal} total.`;

        // Max safe text capacity for lines (Discord limit is 2000 chars)
        const maxLinesLength = 1900 - header.length - footer.length;

        const renderedLines: string[] = [];
        let currentLength = 0;
        let omittedCount = 0;

        for (let i = 0; i < results.length; i++) {
            const res = results[i];
            const critTag = res.hasD20 && res.isNat20 ? ' 💥 *(Nat 20!)*' : (res.hasD20 && res.isNat1 ? ' 💀 *(Nat 1!)*' : '');
            const line = `${res.breakdown} = **${res.total}**${critTag}`;

            // Estimate if adding this line + potential omission message fits
            const potentialOmitMsg = `\n[${results.length - i} results omitted for output size.]`;
            if (currentLength + line.length + 1 + potentialOmitMsg.length > maxLinesLength && i > 0) {
                omittedCount = results.length - i;
                break;
            }

            renderedLines.push(line);
            currentLength += line.length + 1;
        }

        let body = renderedLines.join('\n');
        if (omittedCount > 0) {
            body += `\n[${omittedCount} results omitted for output size.]`;
        }

        const content = `${header}${body}${footer}`;

        return await ctx.sendMessage({
            content,
            allowedMentions: { users: [ctx.author.id] }
        });
    }
}
