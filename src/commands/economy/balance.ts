import { ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Balance extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'balance',
            aliases: ['bal', 'money', 'wallet'],
            description: {
                content: 'Check your or another member\'s Zer (ℤ) balance.',
                usage: 'balance [@user]',
                examples: ['balance', 'balance @User']
            },
            category: 'economy',
            cooldown: 3,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel
            options: [
                {
                    name: 'user',
                    description: 'The user whose balance you want to view',
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        let targetUser = ctx.author;

        if (ctx.isInteraction) {
            const opt = ctx.options.getUser('user');
            if (opt) targetUser = opt;
        } else if (args[0]) {
            const mentionId = args[0].replace(/[<@!>]/g, '');
            const fetched = await client.users.fetch(mentionId).catch(() => null);
            if (fetched) targetUser = fetched;
        }

        const scope = await EconomyManager.getScope(client, ctx);
        const account = await EconomyManager.getAccount(client, targetUser.id, scope);

        const isSelf = targetUser.id === ctx.author.id;
        const scopeLabel = scope === 'global' ? '🌍 Global Economy' : `🏠 Server Economy (${ctx.guild?.name || 'Local'})`;

        const now = Date.now();
        const dailyCooldown = 24 * 60 * 60 * 1000;
        const monthlyCooldown = 30 * 24 * 60 * 60 * 1000;

        let dailyStatus = `${client.emoji.check_success} Ready to claim (\`,daily\`)`;
        if (account.dailyLastClaim) {
            const nextDaily = account.dailyLastClaim.getTime() + dailyCooldown;
            if (nextDaily > now) {
                dailyStatus = `${client.emoji.clock_time} <t:${Math.floor(nextDaily / 1000)}:R>`;
            }
        }

        let monthlyStatus = `${client.emoji.check_success} Ready to claim (\`,monthly\`)`;
        if (account.monthlyLastClaim) {
            const nextMonthly = account.monthlyLastClaim.getTime() + monthlyCooldown;
            if (nextMonthly > now) {
                monthlyStatus = `${client.emoji.clock_time} <t:${Math.floor(nextMonthly / 1000)}:R>`;
            }
        }

        return ctx.replyV2({
            title: `${client.emoji.eco_wallet} ${targetUser.username}'s Balance`,
            description:
                `${client.emoji.eco_wallet} **Wallet:** ${EconomyManager.format(account.wallet)}\n` +
                `${client.emoji.eco_bank} **Bank:** ${EconomyManager.format(account.bank)}\n` +
                `${client.emoji.eco_zer} **Net Worth:** **${EconomyManager.format(account.total)}**\n\n` +
                (isSelf ? `**Claim Status:**\n• Daily: ${dailyStatus}\n• Monthly: ${monthlyStatus}` : ''),
            borderless: true,
            color: null
        });
    }
}
