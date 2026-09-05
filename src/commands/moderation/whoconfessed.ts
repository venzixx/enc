import { PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class WhoConfessed extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'whoconfessed',
			description: {
				content: 'Reveal who wrote a specific confession by its number. Admin only.',
				usage: 'whoconfessed <number>',
				examples: ['whoconfessed 1', 'whoconfessed 5']
			},
			category: 'moderation',
			aliases: ['whoc'],
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'number',
					description: 'The confession number to look up (e.g. 1 for Confession #1)',
					type: 4, // INTEGER
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply(true);
		const number = ctx.options.getInteger('number') || parseInt(args[0]);
        const allowedMentions = { parse: [], roles: [], users: [ctx.author.id], repliedUser: false };

		if (!number || isNaN(number) || number < 1) {
			return await ctx.replyV2({
				title: `${client.emoji.cross} Invalid Number`,
                description: 'Please provide a valid confession number to look up.',
                borderless: true,
                color: null,
                isAlert: true,
                ephemeral: true,
                allowedMentions
			});
		}

		const confession = await client.prisma.confession.findUnique({
			where: {
				guildId_number: {
					guildId: ctx.guild.id,
					number: number
				}
			}
		});

		if (!confession) {
			return await ctx.replyV2({
                title: 'Confession Lookup',
                description: `${client.emoji.cross} Confession **#${number}** was not found in this server.`,
                borderless: true,
                color: null,
                isAlert: true,
                ephemeral: true,
                allowedMentions
            });
		}

		return await ctx.replyV2({
            title: `Confession #${confession.number} Author Revealed`,
            description: confession.content,
            fields: [
                { name: `${client.emoji.user} Author`, value: `${confession.userTag} (<@${confession.userId}>)`, inline: true },
                { name: 'Date', value: `<t:${Math.floor(confession.createdAt.getTime() / 1000)}:R>`, inline: true }
            ],
            borderless: true,
            color: null,
            footer: 'This information is only visible to you.',
            ephemeral: true,
            allowedMentions
        });
	}
}
