import { PermissionFlagsBits, TextChannel } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class LogSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'log-setup',
			description: {
				content: 'Set the channel for advanced server logging.',
				usage: 'log-setup <channel>',
				examples: ['log-setup #logs']
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
					description: 'The channel to send logs in',
					type: 7, // CHANNEL
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel') as TextChannel;

		if (!channel || !channel.isTextBased()) {
			return await ctx.replyV2({ 
                title: `${client.emoji.cross} Setup Error`, 
                description: 'Please select a text-based channel.', 
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
		}

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { logChannelId: channel.id },
			create: { id: ctx.guild.id, logChannelId: channel.id }
		});

		await ctx.replyV2({ 
            title: `${client.emoji.success} Setup Complete`, 
            description: `Server logs will now be sent in ${channel}.`,
            isAlert: true,
            color: client.color.main
        });
	}
}
