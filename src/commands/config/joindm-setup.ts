import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class JoindmSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'joindm-setup',
			description: {
				content: 'Set a message to be DMed to all new members when they join.',
				usage: 'joindm-setup <message>',
				examples: ['joindm-setup "Welcome to {server}, {user}! Enjoy your stay."']
			},
			category: 'systems',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator]
			},
			options: [
				{
					name: 'message',
					description: 'The DM message (use {user} and {server} as placeholders)',
					type: 3, // STRING
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const message = ctx.options.getString('message');

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { joinDmMessage: message },
			create: { id: ctx.guild.id, joinDmMessage: message }
		});

        const preview = message?.replace(/{user}/g, ctx.author.toString()).replace(/{server}/g, ctx.guild.name) || 'No message provided';

        const successEmbed = new EmbedBuilder()
            .setTitle('âœ… Setup Complete')
            .setDescription(`Join DM message has been successfully configured!\n\n**Preview:**\n${preview}`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

