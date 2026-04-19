import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class VanitySetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'vanity-setup',
			description: {
				content: 'Automatically assign a role to users who have a specific vanity link in their status.',
				usage: 'vanity-setup <vanity> <role>',
				examples: ['vanity-setup .gg/encl @Vanity-Supporter']
			},
			category: 'config',
			cooldown: 10,
			slashCommand: false,
			hidden: true,
			permissions: {
				user: [PermissionFlagsBits.ManageGuild],
				client: [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles]
			},
			options: [
				{
					name: 'vanity',
					description: 'The vanity slug to look for (e.g. .gg/encl)',
					type: 3, // STRING
					required: true
				},
				{
					name: 'role',
					description: 'Role to give to users with the vanity in their status',
					type: 8, // ROLE
					required: true
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const slug = ctx.options.getString('slug');
		const role = ctx.options.getRole('role');

		await client.prisma.guild.upsert({
			where: { id: ctx.guild.id },
			update: { vanityString: slug, vanityRoleId: role.id },
			create: { id: ctx.guild.id, vanityString: slug, vanityRoleId: role.id }
		});

        const successEmbed = new EmbedBuilder()
            .setTitle(`${client.emoji.success} Setup Complete`)
            .setDescription(`Vanity tracking has been successfully configured!\n\n**Slug:** \`${slug}\`\n**Role:** ${role}`)
            .setFooter({ text: 'Users with this slug in their status will receive the role automatically.' })
            .setColor(client.color.main)
            .setTimestamp();

		await ctx.reply({ embeds: [successEmbed] });
	}
}
