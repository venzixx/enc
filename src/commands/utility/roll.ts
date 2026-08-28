import { 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { DiceRoller } from '../../utils/DiceRoller';

export default class Roll extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'roll',
            description: {
                content: 'Roll dice with complex expressions, modifiers, and advantage (e.g. d20 + 6, 2d20kh1, 1d8+4).',
                usage: 'roll <dice expression> [reason]',
                examples: [
                    'roll d6',
                    'dr d20 + 6',
                    'dr 2d6 + 1d4 + 3',
                    'dr 2d20kh1 + 5 Attack Roll',
                    'roll 4d6kh3 Stats Roll'
                ]
            },
            category: 'utility',
            aliases: ['dr', 'dice'],
            cooldown: 1,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'expression',
                    description: 'The dice formula to roll (e.g. d20 + 6, 1d20+5, 2d6+3)',
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Optional description or reason for this roll',
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

        let expression: string = '1d20';
        let reason: string = '';

        if (ctx.isInteraction) {
            expression = ctx.options?.getString?.('expression') || '1d20';
            reason = ctx.options?.getString?.('reason') || '';
        } else {
            const parsed = DiceRoller.parseInput(args);
            expression = parsed.expression || '1d20';
            reason = parsed.reason;
        }

        const cleanExpr = expression.trim() || '1d20';
        const result = DiceRoller.roll(cleanExpr);

        // Highlight Nat 20 / Nat 1
        let critTag = '';
        if (result.hasD20) {
            if (result.isNat20) critTag = ' 💥 *(Nat 20!)*';
            else if (result.isNat1) critTag = ' 💀 *(Nat 1!)*';
        }

        const reasonHeader = reason ? ` *(${reason})*` : '';
        const content = `<@${ctx.author.id}> 🎲${reasonHeader}\n**Result:** ${result.breakdown}\n**Total:** ${result.total}${critTag}`;

        return await ctx.sendMessage({
            content,
            allowedMentions: { users: [ctx.author.id] }
        });
    }
}
