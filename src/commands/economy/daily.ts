import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';
import { EconomyManager } from '../../utils/EconomyManager';

export default class Daily extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'daily',
            description: {
                content: 'Claim your daily Zer (ℤ) allowance.',
                usage: 'daily',
                examples: ['daily']
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
        const result = await EconomyManager.claimDaily(client, ctx.author.id, scope);

        if (!result.success && result.nextClaim) {
            const nextTimestamp = Math.floor(result.nextClaim.getTime() / 1000);
            return ctx.replyV2({
                title: `${client.emoji.clock_time} Daily Already Claimed`,
                description: `You have already collected your daily reward! You can claim again <t:${nextTimestamp}:R>.`,
                borderless: true,
                color: null
            });
        }

        return ctx.replyV2({
            title: `${client.emoji.eco_daily} Daily Reward Claimed!`,
            description:
                `You received your daily allowance of **${EconomyManager.format(result.reward!)}**!\n\n` +
                `${client.emoji.eco_wallet} **New Wallet Balance:** ${EconomyManager.format(result.newWallet!)}\n\n` +
                `*Come back in 24 hours for your next reward!*`,
            borderless: true,
            color: null
        });
    }
}
