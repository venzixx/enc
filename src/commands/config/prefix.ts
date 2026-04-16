import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Prefix extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'prefix',
			description: {
				content: 'Manage the bot prefix for this server.',
				usage: 'prefix <new_prefix>',
				examples: ['prefix !']
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
					name: 'set',
					description: 'The new prefix to set',
					type: 3, // STRING
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const newPrefix = ctx.options.getString('set');

		if (newPrefix.length > 5) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Prefix Error')
                .setDescription('Prefix cannot be longer than 5 characters.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { prefix: newPrefix },
			create: { id: ctx.guild.id, prefix: newPrefix }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle('âœ… Prefix Updated')
            .setDescription(`Server prefix has been successfully updated to: \`${newPrefix}\``)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

