import { 
	ApplicationCommandOptionType, 
	ApplicationIntegrationType,
	InteractionContextType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { TordHelper } from '../../utils/TordHelper';

export default class Tord extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'tord',
			aliases: ['truthordare', 'tod', 'truth', 'dare'],
			description: {
				content: 'Play Truth or Dare with live interactive buttons!',
				usage: 'tord [truth | dare | random] [pg | pg13 | r]',
				examples: ['tord', 'tord truth', 'tord dare', 'tord random']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			integration_types: [
				ApplicationIntegrationType.GuildInstall,
				ApplicationIntegrationType.UserInstall
			],
			contexts: [
				InteractionContextType.Guild,
				InteractionContextType.BotDM,
				InteractionContextType.PrivateChannel
			],
			options: [
				{
					name: 'type',
					description: 'Choose Truth, Dare, or Random (default: Random)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: '🎭 Truth', value: 'truth' },
						{ name: '⚡ Dare', value: 'dare' },
						{ name: '🎲 Random', value: 'random' }
					]
				},
				{
					name: 'rating',
					description: 'Question rating filter (default: Any)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: 'PG (Family Friendly)', value: 'pg' },
						{ name: 'PG13 (Teen & Friendly)', value: 'pg13' },
						{ name: 'R (Spicy / 18+)', value: 'r' }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		let requestedType: 'truth' | 'dare' | 'random' = 'random';
		let requestedRating: string | undefined = undefined;

		if (ctx.isInteraction) {
			const t = ctx.options.getString('type');
			if (t === 'truth' || t === 'dare' || t === 'random') requestedType = t;
			requestedRating = ctx.options.getString('rating') || undefined;
		} else {
			// Prefix: determine from alias and arguments
			const invoked = ((ctx as any).prefix ? ctx.message?.content.slice((ctx as any).prefix.length).trim().split(/\s+/)[0]?.toLowerCase() : '') || '';
			if (invoked === 'truth' || invoked === 't') {
				requestedType = 'truth';
			} else if (invoked === 'dare' || invoked === 'd') {
				requestedType = 'dare';
			} else if (args[0]) {
				const first = args[0].toLowerCase();
				if (first === 'truth' || first === 't') requestedType = 'truth';
				else if (first === 'dare' || first === 'd') requestedType = 'dare';
				else if (first === 'random' || first === 'r') requestedType = 'random';
			}

			if (args[1]) {
				const second = args[1].toLowerCase();
				if (['pg', 'pg13', 'r'].includes(second)) requestedRating = second;
			}
		}

		// Channel NSFW check for rating R
		const isNsfwChannel = !ctx.guild || (ctx.channel as any)?.nsfw || (ctx.channel as any)?.type === 1;
		if (requestedRating?.toLowerCase() === 'r' && !isNsfwChannel) {
			return ctx.replyV2({
				title: `${client.emoji.cross} Channel Restriction`,
				description: 'Rating **R** (spicy / 18+) prompts can only be used in **NSFW channels** or DMs.',
				isAlert: true,
				borderless: true,
				color: null,
				ephemeral: true
			});
		}

		const prompt = await TordHelper.fetchPrompt(requestedType, requestedRating);
		const layout = TordHelper.createLayout(prompt, ctx.author.id, requestedRating);

		return ctx.replyV2(layout as any);
	}
}

