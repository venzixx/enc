import { ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Coinflip extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'coinflip',
            aliases: ['cf', 'flip'],
            description: {
                content: 'Gamble your Zer (ℤ) on a 50/50 double-or-nothing coinflip.',
                usage: 'coinflip <amount> [heads|tails]',
                examples: ['coinflip 500', 'cf 50k heads', 'cf 1.5m tails', 'cf all h']
            },
            category: 'economy',
            cooldown: 3,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
            options: [
                {
                    name: 'amount',
                    description: 'Amount of Zer to bet (e.g. 500, 10k, 2.5m, all)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: 'choice',
                    description: 'Call heads or tails (default: heads)',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'Heads', value: 'heads' },
                        { name: 'Tails', value: 'tails' }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let rawAmount: string | null = null;
        let rawChoice: string | null = null;

        if (ctx.isInteraction) {
            rawAmount = ctx.options.getString('amount');
            rawChoice = ctx.options.getString('choice');
        } else {
            const headTailsRegex = /^(h|heads?|t|tails?)$/i;
            if (args[0] && headTailsRegex.test(args[0])) {
                rawChoice = args[0];
                rawAmount = args[1] || null;
            } else if (args[1] && headTailsRegex.test(args[1])) {
                rawAmount = args[0] || null;
                rawChoice = args[1];
            } else {
                rawAmount = args[0] || null;
                rawChoice = args[1] || null;
            }
        }

        const scope = await EconomyManager.getScope(client, ctx);
        const account = await EconomyManager.getAccount(client, ctx.author.id, scope);

        if (!rawAmount) {
            return ctx.replyV2({
                title: '🪙 Coinflip',
                description:
                    `**Usage:** \`,cf <amount> [heads|tails]\`\n` +
                    `**Your Wallet:** **${EconomyManager.format(account.wallet)}**\n\n` +
                    `*Examples:*\n` +
                    `• \`,cf 1000 heads\`\n` +
                    `• \`,cf 50k t\`\n` +
                    `• \`,cf all h\``,
                borderless: true,
                color: null
            });
        }

        // Validate choice (defaults to heads if not specified)
        let chosenSide: 'heads' | 'tails' = 'heads';
        if (rawChoice) {
            const s = rawChoice.toLowerCase();
            if (s === 'h' || s === 'head' || s === 'heads') {
                chosenSide = 'heads';
            } else if (s === 't' || s === 'tail' || s === 'tails') {
                chosenSide = 'tails';
            } else {
                return ctx.replyV2({
                    title: '❌ Invalid Choice',
                    description:
                        'Please choose either **heads** (`h`) or **tails** (`t`).\n\n' +
                        '**Example:** `,cf 50k heads` or `,cf all t`',
                    borderless: true,
                    color: null
                });
            }
        }

        const amount = EconomyManager.parseAmount(rawAmount, account.wallet);
        if (!amount || amount <= 0n) {
            return ctx.replyV2({
                title: '❌ Invalid Bet Amount',
                description:
                    'Please specify a valid positive amount (e.g. `500`, `25k`, `1.5m`, `10t`, or `all`).\n' +
                    `Your wallet balance: **${EconomyManager.format(account.wallet)}**`,
                borderless: true,
                color: null
            });
        }

        if (account.wallet < amount) {
            return ctx.replyV2({
                title: '❌ Insufficient Funds',
                description:
                    `You only have **${EconomyManager.format(account.wallet)}** in your wallet.\n` +
                    `Use \`,withdraw <amount>\` to move Zer from your bank.`,
                borderless: true,
                color: null
            });
        }

        // Determine outcome: 50% heads, 50% tails
        const resultSide: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = resultSide === chosenSide;

        // Execute atomic gamble in database
        const result = await EconomyManager.gamble(client, ctx.author.id, scope, amount, won);
        if (!result.success) {
            return ctx.replyV2({
                title: '❌ Coinflip Failed',
                description: result.error || 'Failed to process transaction.',
                borderless: true,
                color: null
            });
        }

        // Suspense flip
        const spinner = client.emoji.loading_spinner || '🪙';
        await ctx.replyV2({
            title: `${spinner} Coinflip in Progress...`,
            description: `Flipping a coin for **${EconomyManager.format(amount)}** on **${chosenSide.toUpperCase()}**...`,
            borderless: true,
            color: null
        });

        // 1.5s suspense delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const walletEmoji = client.emoji.eco_wallet || '👛';
        if (won) {
            const trophy = client.emoji.game_trophy || client.emoji.check_success || '🎉';
            return ctx.editReplyV2({
                title: `${trophy} You Won!`,
                description:
                    `The coin landed on **${resultSide.toUpperCase()}**!\n\n` +
                    `**Winnings:** +${EconomyManager.format(amount)}\n` +
                    `${walletEmoji} **Wallet Balance:** **${EconomyManager.format(result.newWallet!)}**`,
                borderless: true,
                color: null
            });
        } else {
            const skull = client.emoji.cross_error || '💀';
            return ctx.editReplyV2({
                title: `${skull} You Lost...`,
                description:
                    `The coin landed on **${resultSide.toUpperCase()}**.\n\n` +
                    `**Loss:** -${EconomyManager.format(amount)}\n` +
                    `${walletEmoji} **Wallet Balance:** **${EconomyManager.format(result.newWallet!)}**`,
                borderless: true,
                color: null
            });
        }
    }
}
