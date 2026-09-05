import { 
	ApplicationCommandOptionType, 
	ApplicationIntegrationType,
	InteractionContextType,
	ButtonBuilder, 
	ButtonStyle, 
	ComponentType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

const FALLBACK_TRUTHS = [
	'What is your biggest fear?',
	'What is the most embarrassing thing you\'ve ever done?',
	'What is a secret you\'ve never told anyone?',
	'What is your biggest regret in life so far?',
	'Who was your first celebrity crush?',
	'Have you ever lied to your best friend?',
	'What is the weirdest dream you\'ve ever had?',
	'What is something you are self-conscious about?',
	'What is the biggest trouble you\'ve ever gotten into at school?',
	'If you could trade lives with anyone in this server for a day, who would it be?',
	'What is the silliest reason you\'ve ever cried?',
	'What is your most useless talent?',
	'Have you ever ghosted someone?',
	'What is one thing you would change about yourself if you could?',
	'What is the most awkward text you\'ve ever sent by accident?',
	'If you were invisible for a day, what would you do?',
	'What is the worst advice you have ever followed?',
	'What is a food combination you love that others think is gross?',
	'What is the longest you\'ve gone without showering?',
	'Have you ever pretended to like a gift that you actually hated?'
];

const FALLBACK_DARES = [
	'Do 10 pushups right now.',
	'Sing the chorus of your favorite song in a voice channel.',
	'Send the funniest meme in your camera roll to this chat.',
	'Change your server nickname to \'Captain Clueless\' for 1 hour.',
	'Tell the server your best dad joke.',
	'Speak in rhymes for your next 3 messages.',
	'Post a screenshot of your screen time or battery usage.',
	'Type your next message using only emojis.',
	'Send a voice message saying something silly in an accent.',
	'Compliment 3 different people currently online in the server.',
	'Change your Discord status to \'I am a certified potato 🥔\' for 15 minutes.',
	'Send the last photo taken on your phone without explanation.',
	'Let someone in this server pick your profile banner or status for 30 minutes.',
	'Confess your most unpopular opinion in general chat.',
	'Send a message typing with only your nose or elbow.',
	'Act like a bot for the next 5 minutes in this channel.',
	'Share the first song that plays when you hit shuffle on your playlist.',
	'Text your best friend a completely random animal name with no context.',
	'Do your best impression of an anime character or famous movie line in voice chat.',
	'Type a sentence backwards and make people try to read it.'
];

async function fetchTordPrompt(type: 'truth' | 'dare' | 'random', rating?: string): Promise<{
	type: 'TRUTH' | 'DARE';
	question: string;
	id: string;
	rating: string;
}> {
	const selectedType = type === 'random' 
		? (Math.random() < 0.5 ? 'truth' : 'dare') 
		: type;

	let url = `https://api.truthordarebot.xyz/v1/${selectedType}`;
	if (rating && ['pg', 'pg13', 'r'].includes(rating.toLowerCase())) {
		url += `?rating=${rating.toLowerCase()}`;
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3500);
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);

		if (res.ok) {
			const data: any = await res.json();
			const englishQuestion = data?.question || data?.translations?.en || '';
			if (englishQuestion) {
				return {
					type: (data.type || selectedType).toUpperCase() as 'TRUTH' | 'DARE',
					question: englishQuestion.trim(),
					id: data.id || Math.random().toString(36).substring(2, 8),
					rating: data.rating || (rating ? rating.toUpperCase() : 'PG')
				};
			}
		}
	} catch {}

	// Fallback if API fails
	const isTruth = selectedType === 'truth';
	const list = isTruth ? FALLBACK_TRUTHS : FALLBACK_DARES;
	const randomQuestion = list[Math.floor(Math.random() * list.length)];

	return {
		type: isTruth ? 'TRUTH' : 'DARE',
		question: randomQuestion,
		id: Math.random().toString(36).substring(2, 8),
		rating: rating ? rating.toUpperCase() : 'PG'
	};
}

function getTordPayload(prompt: { type: string; question: string; id: string; rating?: string }, requestedBy?: string, disabled = false) {
	const isTruth = prompt.type.toUpperCase() === 'TRUTH';
	const titleEmoji = isTruth ? '🎭' : '⚡';
	const titleText = isTruth ? 'Truth' : 'Dare';

	const truthBtn = new ButtonBuilder()
		.setCustomId('tord_truth')
		.setLabel('Truth')
		.setEmoji('🎭')
		.setStyle(ButtonStyle.Primary)
		.setDisabled(disabled);

	const dareBtn = new ButtonBuilder()
		.setCustomId('tord_dare')
		.setLabel('Dare')
		.setEmoji('⚡')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(disabled);

	const randomBtn = new ButtonBuilder()
		.setCustomId('tord_random')
		.setLabel('Random')
		.setEmoji('🎲')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled);

	let desc = `### ${prompt.question}\n\n`;
	const meta: string[] = [];
	if (prompt.rating) meta.push(`**Rating:** \`${prompt.rating}\``);
	if (prompt.id) meta.push(`**ID:** \`${prompt.id}\``);
	if (requestedBy) meta.push(`**Turn:** <@${requestedBy}>`);

	if (meta.length > 0) {
		desc += `-# ${meta.join(' • ')}`;
	}

	return V2Helper.createLayout({
		title: `${titleEmoji} ${titleText}`,
		description: desc,
		borderless: true,
		color: null,
		buttons: [truthBtn, dareBtn, randomBtn]
	});
}

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
		const isNsfwChannel = (ctx.channel as any)?.nsfw || (ctx.channel as any)?.type === 1;
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

		let currentPrompt = await fetchTordPrompt(requestedType, requestedRating);
		const initialPayload = getTordPayload(currentPrompt, ctx.author.id, false);

		const replyMsg = await ctx.replyV2(initialPayload as any);
		if (!replyMsg || typeof (replyMsg as any).createMessageComponentCollector !== 'function') {
			return replyMsg;
		}

		const collector = (replyMsg as any).createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 120000 // 2 minutes inactivity timeout
		});

		let isFetching = false;
		collector.on('collect', async (interaction: any) => {
			let nextType: 'truth' | 'dare' | 'random' = 'random';
			if (interaction.customId === 'tord_truth') nextType = 'truth';
			else if (interaction.customId === 'tord_dare') nextType = 'dare';
			else if (interaction.customId === 'tord_random') nextType = 'random';
			else return;

			if (isFetching) {
				await interaction.deferUpdate().catch(() => {});
				return;
			}

			isFetching = true;
			await interaction.deferUpdate().catch(() => {});

			try {
				collector.resetTimer();
				currentPrompt = await fetchTordPrompt(nextType, requestedRating);
				const updatedPayload = getTordPayload(currentPrompt, interaction.user.id, false);
				await interaction.editReply(updatedPayload).catch(async () => {
					await (replyMsg as any).edit?.(updatedPayload).catch(() => {});
				});
			} finally {
				isFetching = false;
			}
		});

		collector.on('end', async () => {
			try {
				const disabledPayload = getTordPayload(currentPrompt, undefined, true);
				await (replyMsg as any).edit?.(disabledPayload);
			} catch {}
		});

		return replyMsg;
	}
}

