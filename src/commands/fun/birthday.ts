import { EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Birthday extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'birthday',
			description: {
				content: 'Set your birthday so we can celebrate it!',
				usage: 'birthday <day> <month> [year]',
				examples: ['birthday 15 4 2005']
			},
			category: 'fun',
			cooldown: 5,
			slashCommand: true,
			options: [
				{
					name: 'day',
					description: 'The day of your birthday (1-31)',
					type: 4, // INTEGER
					required: true,
                    min_value: 1,
                    max_value: 31
				},
				{
					name: 'month',
					description: 'The month of your birthday (1-12)',
					type: 4, // INTEGER
					required: true,
                    min_value: 1,
                    max_value: 12
				},
				{
					name: 'year',
					description: 'The year of your birthday (optional)',
					type: 4, // INTEGER
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const day = ctx.options.getInteger('day');
		const month = ctx.options.getInteger('month');
		const year = ctx.options.getInteger('year');

		await client.prisma.birthday.upsert({
			where: { 
				guildId_userId: {
					guildId: ctx.guild.id,
					userId: ctx.author.id
				}
			},
			update: { day, month, year },
			create: { 
				guildId: ctx.guild.id,
				userId: ctx.author.id,
				day, 
				month, 
				year 
			}
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(' Birthday Set!')
            .setDescription(`Successfully saved your birthday as **${day}/${month}${year ? `/${year}` : ''}**.`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed], flags: [64] });
	}
}

