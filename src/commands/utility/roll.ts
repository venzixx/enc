import { 
    ApplicationIntegrationType, 
    EmbedBuilder, 
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
                content: 'Roll dice with complex expressions, modifiers, and advantage (e.g. d6, 2d20kh1, 1d8+4).',
                usage: 'roll <dice expression> [reason]',
                examples: [
                    'roll d6',
                    'r d6+5',
                    'r 2d6 + 1d4 + 3',
                    'r 2d20kh1 + 5 Attack Roll',
                    'roll 4d6kh3 Stats Roll'
                ]
            },
            category: 'utility',
            aliases: ['r', 'dice'],
            cooldown: 2,
            slashCommand: true,
            integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
            contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
            options: [
                {
                    name: 'expression',
                    description: 'The dice formula to roll (e.g. d6, 1d20+5, 2d6+3)',
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
        let expression = ctx.options?.getString?.('expression');
        let reason = ctx.options?.getString?.('reason');

        if (!expression) {
            if (!args.length) {
                // Default to standard 1d20 if no argument provided
                expression = '1d20';
            } else {
                // Find where the dice formula ends and reason starts
                // Common pattern: ,r 1d20+5 Stealth Check
                const firstArg = args[0];
                // Check if first arg contains dice notation or math symbols
                if (/d|\+|\-|\*|\//i.test(firstArg)) {
                    expression = firstArg;
                    if (args.length > 1) {
                        reason = args.slice(1).join(' ');
                    }
                } else {
                    // Try parsing whole string as expression, or fallback
                    expression = args.join(' ');
                }
            }
        }

        // Clean up expression
        const cleanExpr = expression.trim();
        const result = DiceRoller.roll(cleanExpr);

        const authorName = ctx.author.displayName || ctx.author.username;
        const authorIcon = ctx.author.displayAvatarURL({ size: 128 });

        // Highlight Nat 20 / Nat 1
        let critTag = '';
        if (result.hasD20) {
            if (result.isNat20) critTag = ' 💥 **(Natural 20 - Critical Success!)**';
            else if (result.isNat1) critTag = ' 💀 **(Natural 1 - Critical Failure!)**';
        }

        const embed = new EmbedBuilder()
            .setColor(result.isNat20 ? 0x22c55e : (result.isNat1 ? 0xef4444 : client.color.main))
            .setAuthor({ name: `${authorName} rolled dice`, iconURL: authorIcon });

        if (reason) {
            embed.setTitle(`🎲 ${reason}`);
        }

        embed.setDescription(
            `**Result:** \`${result.total}\`${critTag}\n` +
            `**Breakdown:** \`${result.breakdown}\`\n` +
            `**Formula:** \`${result.expression}\``
        );

        embed.setFooter({ text: 'Tip: Use ,rr <count> <dice> for repeated rolls' });
        embed.setTimestamp();

        return await ctx.sendMessage({ embeds: [embed] });
    }
}
