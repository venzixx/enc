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
		await ctx.deferReply();
		const sub = ctx.options.getSubcommand();
		
		const target = await Resolver.resolveMember(ctx);
		const roleId = ctx.options.getRole('role') as string || args[1]?.replace(/[<@&>]/g, '');
		const role = roleId ? (ctx.guild.roles.cache.get(roleId) || await ctx.guild.roles.fetch(roleId).catch(() => null)) : null;

		if (!target || !role) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Not Found`)
                .setDescription('Could not find that member or role.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		if (role.position >= (ctx.member as GuildMember).roles.highest.position && ctx.guild.ownerId !== ctx.author.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Permission Denied`)
                .setDescription('You cannot manage a role higher than or equal to your own.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.cross} Hierarchy Error`)
                .setDescription('I cannot manage this role. Check my role position and ensure it is below mine.')
                .setColor(client.color.red);
			return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}

		try {
			if (sub === 'add') {
				if (target.roles.cache.has(role.id)) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(`${client.emoji.cross} Already Has Role`)
                        .setDescription(`**${target.user.tag}** already has the ${role} role.`)
                        .setColor(client.color.red);
					return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
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
					return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
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
			await ctx.reply({ embeds: [errorEmbed], flags: [64] });
		}
	}
}
