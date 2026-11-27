import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Monthly extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'monthly',
            description: {
                content: 'Claim your massive monthly Zer (ℤ) bonus.',
                usage: 'monthly',
                examples: ['monthly']
            },
            category: 'economy',
            cooldown: 5,
            slashCommand: true,
            integration_types: [0, 1], // GuildInstall, UserInstall
            contexts: [0, 1, 2] // Guild, BotDM, PrivateChannel
        });
    }

    public async run(client: ExtendedClient, ctx: Context): Promise<any> {
        const scope = await EconomyManager.getScope(client, ctx);
        const result = await EconomyManager.claimMonthly(client, ctx.author.id, scope);

        if (!result.success && result.nextClaim) {
            const nextTimestamp = Math.floor(result.nextClaim.getTime() / 1000);
            return ctx.replyV2({
                title: `${client.emoji.clock_time} Monthly Already Claimed`,
                description: `You have already collected your monthly bonus! You can claim again <t:${nextTimestamp}:R>.`,
                borderless: true,
                color: null
            });
        }

        return ctx.replyV2({
            title: `${client.emoji.eco_monthly} Monthly Bonus Claimed!`,
            description:
                `You received your massive monthly stipend of **${EconomyManager.format(result.reward!)}**!\n\n` +
                `${client.emoji.eco_wallet} **New Wallet Balance:** ${EconomyManager.format(result.newWallet!)}\n\n` +
                `*Claim again in 30 days!*`,
            borderless: true,
            color: null
        });
    }
}
