import { PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { V2Helper } from '../../utils/V2Helper';

export default class VerifySetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'verify-setup',
			description: {
				content: 'Set up the verification gate system with a button.',
				usage: 'verify-setup <channel> <role>',
				examples: ['verify-setup #verify @Verified']
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
					description: 'Channel to send the verification message',
					type: 7, // CHANNEL
					required: true,
					channel_types: [ChannelType.GuildText]
				},
				{
					name: 'role',
					description: 'Role to give upon verification',
					type: 8, // ROLE
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel') as any;
		const role = ctx.options.getRole('role');

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { verificationChannelId: channel.id, verificationRoleId: role.id },
			create: { id: ctx.guild.id, verificationChannelId: channel.id, verificationRoleId: role.id }
		});

		// Build the verification gate V2 layout
		const gateLayout = V2Helper.createLayout({
			title: ' Verification Gate',
			description: `Welcome to **${ctx.guild.name}**!\n\nPlease click the button below to verify yourself and gain access to the rest of the server.`,
			color: client.color.main,
			footer: 'Powered by Enc Security',
			buttons: [
				new ButtonBuilder()
					.setCustomId('verify_button')
					.setLabel('Verify')
					.setEmoji(client.emoji.success)
					.setStyle(ButtonStyle.Secondary)
			]
		});

		await channel.send(gateLayout as any);

		await ctx.replyV2({ 
            title: `${client.emoji.success} Setup Complete`, 
            description: `Verification system has been set up in ${channel} with the ${role} role.`,
            isAlert: true,
            color: client.color.main
        });
	}
}
