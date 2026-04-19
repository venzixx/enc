import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Encode extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'encode',
			description: {
				content: 'Encode text into different formats.',
				usage: 'encode <text> <format>',
				examples: ['encode "Hello World" base64']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: false,
			hidden: true,
			options: [
				{
					name: 'text',
					description: 'The text to encode',
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

		if (format === 'base64') {
			result = Buffer.from(text).toString('base64');
		} else if (format === 'binary') {
			result = text.split('').map((char: string) => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
		}

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.random} Text Encoded`)
            .setDescription(`Successfully encoded your text using **${format.toUpperCase()}**.`)
            .addFields(
                { name: 'Original Text', value: `\`\`\`${text}\`\`\`` },
                { name: 'Encoded Result', value: `\`\`\`${result}\`\`\`` }
            )
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [embed] });
	}
}
