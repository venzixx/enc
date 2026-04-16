import { EmbedBuilder, PermissionFlagsBits, AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationRuleKeywordPresetType, AutoModerationActionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Automod extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'automod',
            description: {
                content: 'Sets up the default Discord Automoderation profanity filters.',
                usage: 'automod',
                examples: ['automod']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.Administrator],
                client: [PermissionFlagsBits.Administrator]
            }
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
        try {
            await ctx.guild.autoModerationRules.create({
                name: 'Enc Profanity Filter',
                creatorId: client.user?.id,
                enabled: true,
                eventType: AutoModerationRuleEventType.MessageSend,
                triggerType: AutoModerationRuleTriggerType.KeywordPreset,
                triggerMetadata: {
                    presets: [
                        AutoModerationRuleKeywordPresetType.Profanity,
                        AutoModerationRuleKeywordPresetType.SexualContent,
                        AutoModerationRuleKeywordPresetType.Slurs
                    ]
                },
                actions: [
                    {
                        type: AutoModerationActionType.BlockMessage,
                        metadata: {
                            customMessage: 'This message was blocked by Enc Security Automod.'
                        }
                    }
                ]
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('âœ… Automod Initialized')
                .setDescription('The default Discord profanity, slur, and sexual content filters have been enabled and set to block messages.')
                .setColor(client.color.main)
                .setTimestamp();

            await ctx.reply({ embeds: [successEmbed] });
        } catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Setup Failed')
                .setDescription('Failed to setup AutoMod rules. Please ensure I have **Administrator** permissions and that you haven\'t reached the rule limit.')
                .setColor(client.color.red);

            await ctx.reply({ embeds: [errorEmbed], flags: [64] });
        }
    }
}

