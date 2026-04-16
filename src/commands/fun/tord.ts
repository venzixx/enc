import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

const truths = [
    "What is your biggest fear?",
    "What is the most embarrassing thing you've ever done?",
    "What is a secret you've never told anyone?",
    "What is your biggest regret?",
    "Who was your first crush?",
    "Have you ever lied to your best friend?",
    "What is the weirdest dream you've ever had?"
];

const dares = [
    "Do 10 pushups.",
    "Sing your favorite song in a voice channel.",
    "Send a funny meme in the general chat.",
    "Change your nickname to 'Cool Cat' for 1 hour.",
    "Tell a joke to the entire server.",
    "Post a random picture from your phone in media.",
    "Write 'I love Enc' in every channel you have access to (Don't actually spam!)."
];

export default class Tord extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'tord',
			description: {
				content: 'Play Truth or Dare!',
				usage: 'tord <truth/dare>',
				examples: ['tord truth']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'type',
					description: 'Truth or Dare?',
					type: 3, // STRING
					required: true,
					choices: [
						{ name: 'Truth', value: 'truth' },
						{ name: 'Dare', value: 'dare' }
					]
				}
			]
		});
	}

	public async run(_client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const type = ctx.options.getString('type');
		const list = type === 'truth' ? truths : dares;
		const random = list[Math.floor(Math.random() * list.length)];

		const embed = new EmbedBuilder()
			.setTitle(type === 'truth' ? 'ðŸ’¡ Truth' : 'ðŸ”¥ Dare')
			.setDescription(`**${random}**`)
			.setColor(_client.color.main)
			.setFooter({ text: 'Truth or Dare â€¢ Interactive Games', iconURL: ctx.guild.iconURL() })
            .setTimestamp();

		await ctx.reply({ embeds: [embed] });
	}
}
