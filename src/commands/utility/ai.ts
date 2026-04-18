import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class AICommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ai',
			description: {
				content: 'Configure the bot\'s AI personality and web search capabilities.',
				usage: 'ai <character | search>',
				examples: ['ai character preset:Cyberpunk', 'ai character preset:Custom', 'ai search enabled:True']
			},
			category: 'general',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'character',
					description: 'Set the bot\'s AI personality',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'preset',
							description: 'Choose a character preset',
							type: 3, // STRING
							required: true,
							choices: [
								{ name: 'Default (Casual/Chill)', value: 'CASUAL' },
								{ name: 'Cyberpunk (Future/Tech)', value: 'CYBERPUNK' },
								{ name: 'Victorian (Formal/Polite)', value: 'VICTORIAN' },
								{ name: 'Sarcastic (Dark/Witty)', value: 'SARCASTIC' },
								{ name: 'Minimalist (Brief/Fast)', value: 'MINIMALIST' },
								{ name: 'Custom (Your own prompt)', value: 'CUSTOM' }
							]
						}
					]
				},
				{
					name: 'search',
					description: 'Toggle AI web search capabilities',
					type: 1, // SUB_COMMAND
					options: [
						{
							name: 'enabled',
							description: 'Enable or disable web search',
							type: 5, // BOOLEAN
							required: true
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const sub = ctx.options.getSubcommand();

		if (sub === 'character') {
			const preset = ctx.options.getString('preset');

			if (preset === 'CUSTOM') {
				// Open Modal for Custom Prompt
				const modal = new ModalBuilder()
					.setCustomId('ai_character_modal')
					.setTitle('Set Custom AI Personality');

				const promptInput = new TextInputBuilder()
					.setCustomId('ai_custom_prompt')
					.setLabel('Describe how the bot should talk:')
					.setPlaceholder('e.g. You are a pirate who loves treasure and says "Arrr" every time.')
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true)
					.setMaxLength(1000);

				const row = new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput);
				modal.addComponents(row);

				return await (ctx.interaction as any).showModal(modal);
			}

			// Save Preset to Database
			await ctx.deferReply();
			await client.prisma.guild.update({
				where: { id: ctx.guild.id },
				data: { aiPersonality: preset }
			});

			return await ctx.replyV2({
                title: `${client.emoji.success} AI Personality Updated`,
                description: `I will now act like a **${preset}** character in this server.`,
                isAlert: true,
                color: client.color.main
            });
		}

		if (sub === 'search') {
			const enabled = ctx.options.getBoolean('enabled');

			await ctx.deferReply();
			await client.prisma.guild.update({
				where: { id: ctx.guild.id },
				data: { aiSearchEnabled: enabled }
			});

			return await ctx.replyV2({
                title: `${client.emoji.success} Search Settings Updated`,
                description: `AI web search is now **${enabled ? 'enabled' : 'disabled'}**.`,
                isAlert: true,
                color: client.color.main
            });
		}
	}
}
