import { EmbedBuilder, PermissionFlagsBits, GuildMember, Role } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';

export default class RoleCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'role',
			description: {
				content: 'Add or remove a role from a member.',
				usage: 'role <add/remove> <user> <role>',
				examples: ['role add @Member @Admin']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageRoles],
				client: [PermissionFlagsBits.ManageRoles]
			},
			options: [
				{
					name: 'add',
					description: 'Add a role to a member',
					type: 1,
					options: [
						{ name: 'user', description: 'The member', type: 6, required: true },
						{ name: 'role', description: 'The role', type: 8, required: true }
					]
				},
				{
					name: 'remove',
					description: 'Remove a role from a member',
					type: 1,
					options: [
						{ name: 'user', description: 'The member', type: 6, required: true },
						{ name: 'role', description: 'The role', type: 8, required: true }
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		let sub: string | null = null;
		let target: GuildMember | null = null;
		let role: Role | null = null;

		if (ctx.interaction) {
			await ctx.deferReply();
			sub = ctx.options.getSubcommand();
			target = ctx.options.getMember('user') as GuildMember;
			role = ctx.options.getRole('role') as Role;
		} else {
			// Prefix command logic: ,role <add/remove> <user> <role name>
			sub = args[0]?.toLowerCase();
			if (!sub || !['add', 'remove'].includes(sub)) {
				const usageEmbed = new EmbedBuilder()
					.setTitle('Role Command Usage')
					.setDescription(`\`${ctx.prefix}role add <user> <role name>\`\n\`${ctx.prefix}role remove <user> <role name>\``)
					.setColor(client.color.main);
				return await ctx.reply({ embeds: [usageEmbed] });
			}

			if (!args[1]) {
				return await ctx.reply({ content: 'Please provide a member.' });
			}

			// Resolve member
			target = await Resolver.resolveMember(ctx, args[1]);
			
			if (!args[2]) {
				return await ctx.reply({ content: 'Please provide a role name or mention.' });
			}

			// Resolve role: check mention/ID first, then search by name
			const roleQuery = args.slice(2).join(' ');
			const roleId = roleQuery.replace(/[<@&>]/g, '');
			role = ctx.guild.roles.cache.get(roleId) || 
				   ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === roleQuery.toLowerCase()) ||
				   ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase().includes(roleQuery.toLowerCase()));
		}

        const prefix = ctx.prefix || client.config.prefix;
        if (!client.db || !ctx.guild.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Not Found`)
                .setDescription(`Could not find that ${!target ? 'member' : 'role'}.`)
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed] });
		}

		if (!target || !role) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Not Found`)
                .setDescription(`Could not find that ${!target ? 'member' : 'role'}.`)
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed] });
		}

		// Permission and hierarchy checks
		if (role.position >= (ctx.member as GuildMember).roles.highest.position && ctx.guild.ownerId !== ctx.author.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Permission Denied`)
                .setDescription('You cannot manage a role higher than or equal to your own.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed] });
		}

		if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Hierarchy Error`)
                .setDescription('I cannot manage this role. Check my role position and ensure it is below mine.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed] });
		}

		try {
			if (sub === 'add') {
				if (target.roles.cache.has(role.id)) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(`${client.emoji.cross} Already Has Role`)
                        .setDescription(`**${target.user.tag}** already has the ${role} role.`)
                        .setColor(client.color.red);
					return await ctx.reply({ embeds: [errorEmbed] });
				}
				await target.roles.add(role);
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${client.emoji.success} Role Added`)
                    .setDescription(`Successfully added the ${role} role to **${target.user.tag}**.`)
                    .setColor(client.color.main)
                    .setTimestamp();
				await ctx.reply({ embeds: [successEmbed] });
			} else {
				if (!target.roles.cache.has(role.id)) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(`${client.emoji.cross} Missing Role`)
                        .setDescription(`**${target.user.tag}** does not have the ${role} role.`)
                        .setColor(client.color.red);
					return await ctx.reply({ embeds: [errorEmbed] });
				}
				await target.roles.remove(role);
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${client.emoji.success} Role Removed`)
                    .setDescription(`Successfully removed the ${role} role from **${target.user.tag}**.`)
                    .setColor(client.color.main)
                    .setTimestamp();
				await ctx.reply({ embeds: [successEmbed] });
			}
		} catch (e: any) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Execution Error`)
                .setDescription(`An error occurred: ${e.message}`)
                .setColor(client.color.red);
			await ctx.reply({ embeds: [errorEmbed] });
		}
	}
}
