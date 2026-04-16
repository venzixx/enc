import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class RandomQuote extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'random-quote',
			description: {
				content: 'Get a random inspiring quote.',
				usage: 'random-quote',
				examples: ['random-quote']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		try {
			const response = await fetch('https://api.quotable.io/random');
			const data: any = await response.json();

			const embed = new EmbedBuilder()
				.setTitle('📜 Quote')
				.setDescription(`"${data.content}"`)
				.setFields({ name: '— Author', value: data.author })
				.setColor(_client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Quote Error')
                .setDescription('Could not fetch a quote at the moment. Try again later!')
                .setColor(_client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
