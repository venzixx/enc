import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Decode extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'decode',
			description: {
				content: 'Decode text from different formats.',
				usage: 'decode <text> <format>',
				examples: ['decode SGVsbG8gV29ybGQ= base64']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: false,
			hidden: true,
			options: [
				{
					name: 'text',
					description: 'The text to decode',
					type: 3,
					required: true
				},
				{
					name: 'format',
					description: 'The encoding format',
					type: 3,
					required: true,
					choices: [
						{ name: 'Base64', value: 'base64' },
						{ name: 'Binary', value: 'binary' }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const text = ctx.options.getString('text');
		const format = ctx.options.getString('format');

		let result = '';

		try {
			if (format === 'base64') {
				result = Buffer.from(text, 'base64').toString('utf-8');
			} else if (format === 'binary') {
				result = text.split(' ').map((bin: string) => String.fromCharCode(parseInt(bin, 2))).join('');
			}
            
            const embed = new EmbedBuilder()
                .setTitle(`${client.emoji.random} Text Decoded`)
                .setDescription(`Successfully decoded your text from **${format.toUpperCase()}**.`)
                .addFields(
                    { name: 'Encoded Input', value: `\`\`\`${text}\`\`\`` },
                    { name: 'Decoded Result', value: `\`\`\`${result || 'None (Empty or Invalid)'}\`\`\`` }
                )
                .setColor(client.color.main)
                .setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Decoding Error')
                .setDescription(`Failed to decode text. Please ensure it is valid **${format.toUpperCase()}** format.`)
                .setColor(client.color.red);

			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
