import { 
	ButtonBuilder, 
	ButtonStyle, 
	ComponentType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

const FALLBACK_QUOTES: { quote: string; author: string }[] = [
	{ quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
	{ quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
	{ quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
	{ quote: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
	{ quote: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
	{ quote: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama' },
	{ quote: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
	{ quote: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
	{ quote: 'Act as if what you do makes a difference. It does.', author: 'William James' },
	{ quote: 'You have power over your mind - not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
	{ quote: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde' },
	{ quote: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
	{ quote: 'Keep your face always toward the sunshine—and shadows will fall behind you.', author: 'Walt Whitman' },
	{ quote: 'The only limit to our realization of tomorrow will be our doubts of today.', author: 'Franklin D. Roosevelt' },
	{ quote: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
	{ quote: 'You will face many defeats in life, but never let yourself be defeated.', author: 'Maya Angelou' },
	{ quote: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair' },
	{ quote: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey' },
	{ quote: 'Spread love everywhere you go. Let no one ever come to you without leaving happier.', author: 'Mother Teresa' },
	{ quote: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
	{ quote: 'We must believe that we are gifted for something, and that this thing, at whatever cost, must be attained.', author: 'Marie Curie' },
	{ quote: 'Your time is limited, so don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
	{ quote: 'Change your thoughts and you change your world.', author: 'Norman Vincent Peale' }
];

async function fetchQuote(): Promise<{ quote: string; author: string }> {
	// 1. Primary: ZenQuotes API
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3500);
		const res = await fetch('https://zenquotes.io/api/random', { signal: controller.signal });
		clearTimeout(timeout);
		if (res.ok) {
			const data: any = await res.json();
			if (Array.isArray(data) && data[0]?.q && data[0]?.a) {
				return { quote: data[0].q.trim(), author: data[0].a.trim() };
			}
		}
	} catch {}

	// 2. Secondary: DummyJSON Quotes API
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3500);
		const res = await fetch('https://dummyjson.com/quotes/random', { signal: controller.signal });
		clearTimeout(timeout);
		if (res.ok) {
			const data: any = await res.json();
			if (data?.quote && data?.author) {
				return { quote: data.quote.trim(), author: data.author.trim() };
			}
		}
	} catch {}

	// 3. Fallback: Curated internal quote library
	return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

function getQuotePayload(quote: string, author: string, disabled = false) {
	const refreshBtn = new ButtonBuilder()
		.setCustomId('quote_refresh')
		.setLabel('Another Quote')
		.setEmoji('🔄')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled);

	return V2Helper.createLayout({
		title: '💭 Words of Wisdom',
		description: `> *" ${quote} "*\n\n— **${author}**`,
		borderless: true,
		color: null,
		buttons: [refreshBtn]
	});
}

export default class RandomQuote extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'random-quote',
			aliases: ['randomquote', 'rq', 'inspire', 'motivate', 'quote-random'],
			description: {
				content: 'Get a random inspiring quote (Prefix only).',
				usage: 'random-quote | rq | inspire',
				examples: ['random-quote', 'rq', 'inspire']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: false
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		let currentQuote = await fetchQuote();
		const initialLayout = getQuotePayload(currentQuote.quote, currentQuote.author, false);

		const replyMsg = await ctx.replyV2(initialLayout as any);
		if (!replyMsg || typeof (replyMsg as any).createMessageComponentCollector !== 'function') {
			return replyMsg;
		}

		const collector = (replyMsg as any).createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 120000
		});

		let isFetching = false;
		collector.on('collect', async (interaction: any) => {
			if (interaction.customId === 'quote_refresh') {
				if (isFetching) {
					await interaction.deferUpdate().catch(() => {});
					return;
				}

				isFetching = true;
				await interaction.deferUpdate().catch(() => {});

				try {
					currentQuote = await fetchQuote();
					const updatedLayout = getQuotePayload(currentQuote.quote, currentQuote.author, false);
					await interaction.editReply(updatedLayout).catch(async () => {
						await (replyMsg as any).edit?.(updatedLayout).catch(() => {});
					});
				} finally {
					isFetching = false;
				}
			}
		});

		collector.on('end', async () => {
			try {
				const disabledLayout = getQuotePayload(currentQuote.quote, currentQuote.author, true);
				await (replyMsg as any).edit?.(disabledLayout);
			} catch {}
		});

		return replyMsg;
	}
}
