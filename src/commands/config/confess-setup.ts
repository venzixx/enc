import { 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle,
    TextChannel
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class ConfessSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'confess-setup',
			description: {
				content: 'Set the channel where anonymous confessions will be posted.',
				usage: 'confess-setup <channel>',
				examples: ['confess-setup #confessions']
			},
			category: 'social',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator]
			},
			options: [
				{
					name: 'channel',
					description: 'The channel to post confessions in',
					type: 7, // CHANNEL
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel') as TextChannel;

		if (!channel.isTextBased()) {
			return await ctx.replyV2({ 
                title: 'âŒ Setup Error', 
                description: 'Please select a text-based channel.', 
                isAlert: true,
                color: client.color.red,
                ephemeral: true
            });
		}

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { confessionChannel: channel.id },
			create: { id: ctx.guild.id, confessionChannel: channel.id }
		});

        // Send starter message to the confession channel via V2
        await channel.send(V2Helper.createLayout({
            title: 'ðŸ¤« Anonymous Confessions',
            description: 'Share your deepest secrets anonymously! Click the button below to send a confession.',
            color: client.color.main,
            footer: 'Your identity will remain completely hidden.',
            buttons: [
                new ButtonBuilder()
                    .setCustomId('confess_create')
                    .setLabel('ðŸ“ Send Confession')
                    .setStyle(ButtonStyle.Primary)
            ]
        }) as any).catch(() => {});

		await ctx.replyV2({ 
            title: 'âœ… Setup Complete', 
            description: `Anonymous confessions will now be posted in ${channel}. A starter button has been sent there.`,
            isAlert: true,
            color: client.color.main
        });
	}
}
