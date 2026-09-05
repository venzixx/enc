import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { V2Helper, V2Options } from './V2Helper';

export const FALLBACK_TRUTHS = [
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

export const FALLBACK_DARES = [
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

export interface TordPrompt {
	type: 'TRUTH' | 'DARE';
	question: string;
	id: string;
	rating: string;
}

export class TordHelper {
	public static async fetchPrompt(type: 'truth' | 'dare' | 'random', rating?: string): Promise<TordPrompt> {
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

	public static createLayout(prompt: TordPrompt, requestedBy?: string, rating?: string) {
		const isTruth = prompt.type.toUpperCase() === 'TRUTH';
		const titleEmoji = isTruth ? '🎭' : '⚡';
		const titleText = isTruth ? 'Truth' : 'Dare';

		const ratingSuffix = rating && ['pg', 'pg13', 'r'].includes(rating.toLowerCase()) ? `_${rating.toLowerCase()}` : '';

		const truthBtn = new ButtonBuilder()
			.setCustomId(`tord_truth${ratingSuffix}`)
			.setLabel('Truth')
			.setEmoji('🎭')
			.setStyle(ButtonStyle.Primary);

		const dareBtn = new ButtonBuilder()
			.setCustomId(`tord_dare${ratingSuffix}`)
			.setLabel('Dare')
			.setEmoji('⚡')
			.setStyle(ButtonStyle.Danger);

		const randomBtn = new ButtonBuilder()
			.setCustomId(`tord_random${ratingSuffix}`)
			.setLabel('Random')
			.setEmoji('🎲')
			.setStyle(ButtonStyle.Secondary);

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
}
