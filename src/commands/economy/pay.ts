import { ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Pay extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'pay',
            aliases: ['give', 'transfer', 'send'],
            description: {
                content: 'Transfer Zer (ℤ) to another user. Supports amounts up to trillions (e.g. 50k, 2.5m, 10t, all).',
                usage: 'pay <@user> <amount>',
                examples: ['pay @User 500', 'pay @User 1.5m', 'pay @User 2t', 'pay @User all']
            },
            category: 'economy',
            cooldown: 3,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
            options: [
                {
                    name: 'user',
                    description: 'The user to receive your Zer',
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'amount',
                    description: 'Amount to pay (e.g. 100, 50k, 2.5m, 10t, all)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let targetUser: any = null;
        let rawAmount = '';

        if (ctx.isInteraction) {
            targetUser = ctx.options.getUser('user');
            rawAmount = ctx.options.getString('amount') || '';
        } else {
            if (args[0]) {
                const mentionId = args[0].replace(/[<@!>]/g, '');
                targetUser = await client.users.fetch(mentionId).catch(() => null);
            }
            rawAmount = args[1] || '';
        }

        if (!targetUser) {
            return ctx.replyV2({
                title: '❌ Missing Recipient',
                description: 'Please specify the user you want to pay: `,pay <@user> <amount>`',
                borderless: true,
                color: null
            });
        }

        if (targetUser.id === ctx.author.id) {
            return ctx.replyV2({
                title: '❌ Invalid Recipient',
                description: 'You cannot transfer Zer to yourself!',
                borderless: true,
                color: null
            });
        }

        if (targetUser.bot) {
            return ctx.replyV2({
                title: '❌ Invalid Recipient',
                description: 'Bots have no need for mortal currency.',
                borderless: true,
                color: null
            });
        }

        const scope = await EconomyManager.getScope(client, ctx);
        const senderAccount = await EconomyManager.getAccount(client, ctx.author.id, scope);

        const amount = EconomyManager.parseAmount(rawAmount, senderAccount.wallet);
        if (!amount || amount <= 0n) {
            return ctx.replyV2({
                title: '❌ Invalid Amount',
                description:
                    'Please specify a valid positive amount (e.g. `500`, `25k`, `1.5m`, `3b`, `10t`, or `all`).\n' +
                    `Your current wallet balance: **${EconomyManager.format(senderAccount.wallet)}**`,
                borderless: true,
                color: null
            });
        }

        if (senderAccount.wallet < amount) {
            return ctx.replyV2({
                title: '❌ Insufficient Funds',
                description:
                    `You only have **${EconomyManager.format(senderAccount.wallet)}** in your wallet.\n` +
                    (senderAccount.bank >= amount ? `*(Tip: You have enough in your bank! Use \`,withdraw ${rawAmount}\` first.)*` : ''),
                borderless: true,
                color: null
            });
        }

        const result = await EconomyManager.transfer(client, ctx.author.id, targetUser.id, scope, amount);
        if (!result.success) {
            return ctx.replyV2({
                title: '❌ Transfer Failed',
                description: result.error || 'An unexpected error occurred during the transaction.',
                borderless: true,
                color: null
            });
        }

        return ctx.replyV2({
            title: `${client.emoji.eco_pay} Payment Sent`,
            description:
                `Successfully transferred **${EconomyManager.format(amount)}** to <@${targetUser.id}>!\n\n` +
                `${client.emoji.eco_wallet} **Your Wallet:** ${EconomyManager.format(senderAccount.wallet - amount)}`,
            borderless: true,
            color: null
        });
    }
}
