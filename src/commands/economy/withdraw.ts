import { ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Withdraw extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'withdraw',
            aliases: ['with'],
            description: {
                content: 'Withdraw Zer (ℤ) from your bank into your active wallet.',
                usage: 'withdraw <amount|all>',
                examples: ['withdraw 1000', 'withdraw 50k', 'withdraw 2m', 'withdraw all']
            },
            category: 'economy',
            cooldown: 3,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
            options: [
                {
                    name: 'amount',
                    description: 'Amount to withdraw from bank (e.g. 500, 10k, 2.5m, all)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const rawAmount = ctx.isInteraction ? ctx.options.getString('amount') || '' : args[0] || '';
        const scope = await EconomyManager.getScope(client, ctx);
        const account = await EconomyManager.getAccount(client, ctx.author.id, scope);

        const amount = EconomyManager.parseAmount(rawAmount, account.bank);
        if (!amount || amount <= 0n) {
            return ctx.replyV2({
                title: '❌ Invalid Amount',
                description:
                    'Please specify a valid positive amount (e.g. `500`, `25k`, `1.5m`, `10t`, or `all`).\n' +
                    `Your bank balance: **${EconomyManager.format(account.bank)}**`,
                borderless: true,
                color: null
            });
        }

        const result = await EconomyManager.withdraw(client, ctx.author.id, scope, amount);
        if (!result.success) {
            return ctx.replyV2({
                title: '❌ Withdrawal Failed',
                description: result.error || 'Failed to withdraw funds.',
                borderless: true,
                color: null
            });
        }

        return ctx.replyV2({
            title: `${client.emoji.eco_withdraw} Withdrawal Successful`,
            description:
                `Successfully withdrew **${EconomyManager.format(amount)}** from your bank!\n\n` +
                `${client.emoji.eco_wallet} **Wallet:** ${EconomyManager.format(result.wallet!)}\n` +
                `${client.emoji.eco_bank} **Bank:** ${EconomyManager.format(result.bank!)}`,
            borderless: true,
            color: null
        });
    }
}
