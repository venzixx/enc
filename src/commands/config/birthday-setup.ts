import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class BirthdaySetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'birthday-setup',
			description: {
				content: 'Configure the birthday announcement system.',
				usage: 'birthday-setup <channel> [ping_role]',
				examples: ['birthday-setup #birthdays @Birthday-Ping']
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
					description: 'The channel to announce birthdays in',
					type: 7, // CHANNEL
					required: true
				},
				{
					name: 'ping_role',
					description: 'Role to ping during announcements',
					type: 8, // ROLE
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const channel = ctx.options.getChannel('channel');
		const role = ctx.options.getRole('ping_role');

		if (!channel.isTextBased()) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' Setup Error')
                .setDescription('Please select a text-based channel.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { 
				birthdayChannelId: channel.id,
				birthdayPingRoleId: role?.id || null
			},
			create: { 
				id: ctx.guild.id, 
				birthdayChannelId: channel.id,
				birthdayPingRoleId: role?.id || null
			}
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Setup Complete`)
            .setDescription(`Birthday announcement system has been configured!\n\n**Channel:** ${channel}\n**Ping Role:** ${role || 'None'}`)
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}

