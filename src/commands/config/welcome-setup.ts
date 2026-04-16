import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class WelcomeSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'welcome-setup',
			description: {
				content: 'Set the channel where welcome messages with images will be sent.',
				usage: 'welcome-setup <channel>',
				examples: ['welcome-setup #welcome']
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
					name: 'channel',
					description: 'The channel to send welcome messages in',
					type: 7, // CHANNEL
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel');

		if (!channel.isTextBased()) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('âŒ Setup Error')
                .setDescription('Please select a text-based channel.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { welcomeChannelId: channel.id },
			create: { id: ctx.guild.id, welcomeChannelId: channel.id }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle('âœ… Setup Complete')
            .setDescription(`Welcome messages will now be sent in ${channel}.`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

