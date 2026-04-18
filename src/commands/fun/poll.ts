import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Poll extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'poll',
			description: {
				content: 'Create a native Discord poll with an automated discussion thread.',
				usage: 'poll <question> <options...>',
				examples: ['poll "What is your favorite color?" "Red" "Blue" "Green"']
			},
			category: 'fun',
			cooldown: 3,
			slashCommand: true,
			options: [
				{
					name: 'question',
					description: 'The question for the poll',
					type: 3, // STRING
					required: true
				},
				{
					name: 'option1',
					description: 'First option',
					type: 3,
					required: true
				},
				{
					name: 'option2',
					description: 'Second option',
					type: 3,
					required: true
				},
				{
					name: 'option3',
					description: 'Third option',
					type: 3,
					required: false
				},
				{
					name: 'option4',
					description: 'Fourth option',
					type: 3,
					required: false
				},
                {
					name: 'multiselect',
					description: 'Allow multiple answers?',
					type: 5, // BOOLEAN
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const question = ctx.options.getString('question');
		const multiselect = ctx.options.getBoolean('multiselect') ?? false;

		const options: string[] = [];
		for (let i = 1; i <= 4; i++) {
			const opt = ctx.options.getString(`option${i}`);
			if (opt) options.push(opt);
		}

		if (options.length < 2) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Poll Error')
                .setDescription('A poll must have at least 2 options.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		try {
			const pollData = {
				question: { text: question },
				answers: options.map(opt => ({ text: opt })),
				allowMultiselect: multiselect,
				duration: 24 
			};

			const pollMessage = await ctx.channel.send({ poll: pollData });

			await pollMessage.startThread({
				name: `Poll Discussion - ${question.substring(0, 50)}`,
				autoArchiveDuration: 1440,
				reason: 'Poll discussion thread'
			});

            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Poll Created`)
                .setDescription(`Your poll has been successfully created in this channel.\n\n[Click here to jump to the poll](${pollMessage.url})`)
                .setColor(client.color.main)
                .setTimestamp();

			await ctx.reply({ embeds: [successEmbed], flags: [64] });
		} catch (error: any) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Poll Failure')
                .setDescription(`Failed to create poll: ${error.message}`)
                .setColor(client.color.red);
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
