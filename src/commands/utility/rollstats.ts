import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { DiceRoller } from '../../utils/DiceRoller';

export default class RollStats extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'rollstats',
            description: {
                content: 'Roll 6 ability scores using 4d6 drop lowest (4d6kh3) for D&D / RPG character creation.',
                usage: 'rollstats [reason]',
                examples: [
                    'rollstats',
                    'rollstats Wizard Character',
                    'statsroll New Campaign'
                ]
            },
            category: 'utility',
            aliases: ['rollstat', 'statsroll', 'abilityscores', 'dndstats'],
            cooldown: 2,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'reason',
                    description: 'Optional character name or description for this roll',
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

        let reason = '';
        if (ctx.isInteraction) {
            reason = ctx.options?.getString?.('reason') || '';
        } else if (args.length > 0) {
            reason = args.join(' ').trim();
        }

        const stats: { index: number; breakdown: string; total: number }[] = [];
        let grandTotal = 0;

        for (let i = 1; i <= 6; i++) {
            const res = DiceRoller.roll('4d6kh3');
            stats.push({
                index: i,
                breakdown: res.breakdown,
                total: res.total
            });
            grandTotal += res.total;
        }

        const reasonHeader = reason ? ` *(${reason})*` : '';
        const statLines = stats.map(s => `Stat ${s.index}: ${s.breakdown} = **${s.total}**`).join('\n');

        const content = 
`<@${ctx.author.id}> 🎲 **Generating Random Stats**${reasonHeader}

**Stats**
${statLines}
─────
**Total = ${grandTotal}**`;

        return await ctx.sendMessage({
            content,
            allowedMentions: { users: [ctx.author.id] }
        });
    }
}
