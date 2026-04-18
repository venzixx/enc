import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class Customrole extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'customrole',
			description: {
				content: 'Create and manage your own personal cosmetic role.',
				usage: 'customrole <create/delete/name/color> [params]',
				examples: ['customrole create "Cool Guy" #FFFFFF', 'customrole color #FF0000']
			},
			category: 'owner',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ManageRoles], // Usually you want this allowed for everyone if configured, but for now stick to ManageRoles or specific logic
				client: [PermissionFlagsBits.ManageRoles]
			},
			options: [
				{
					name: 'create',
					description: 'Create your custom role',
					type: 1,
					options: [
						{ name: 'name', description: 'Name for the role', type: 3, required: true },
						{ name: 'color', description: 'Hex color', type: 3, required: true }
					]
				},
				{
					name: 'color',
					description: 'Change your custom role color',
					type: 1,
					options: [
						{ name: 'color', description: 'New hex color', type: 3, required: true }
					]
				},
				{
					name: 'delete',
					description: 'Delete your custom role',
					type: 1
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		await ctx.deferReply();
		const sub = ctx.options.getSubcommand();
		const userId = ctx.author.id;

		const existing = await client.prisma.customRole.findUnique({
			where: { guildId_userId: { guildId: ctx.guild.id, userId } }
		});

		if (sub === 'create') {
			if (existing) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(' Already exists')
                    .setDescription('You already have a custom role.')
                    .setColor(client.color.red);
                return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
            }

			const name = ctx.options.getString('name');
			const color = ctx.options.getString('color');

			try {
				const role = await ctx.guild.roles.create({
					name,
					color: color as any,
					reason: `Custom role for ${ctx.author.tag}`
				});

				await (ctx.member as any).roles.add(role);
				await client.prisma.customRole.create({
					data: { guildId: ctx.guild.id, userId, roleId: role.id }
				});

                const successEmbed = new EmbedBuilder()
                    .setTitle(`${client.emoji.success} Role Created`)
                    .setDescription(`Created and added your custom role: ${role}`)
                    .setColor(client.color.main)
                    .setTimestamp();

				return await ctx.reply({ embeds: [successEmbed] });
			} catch (e: any) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(' Error')
                    .setDescription(`An error occurred: ${e.message}`)
                    .setColor(client.color.red);
				await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}
		}

		if (!existing) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(' No Role Found')
                .setDescription('You do not have a custom role.')
                .setColor(client.color.red);
            return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
        }

		const role = await ctx.guild.roles.fetch(existing.roleId).catch(() => null);

		if (sub === 'color') {
			if (!role) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(' Role Lost')
                    .setDescription('Your role was manually deleted from the server.')
                    .setColor(client.color.red);
                return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
            }
			const color = ctx.options.getString('color');
			await role.setColor(color as any);
            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Color Updated`)
                .setDescription(`Updated your role color to \`${color}\`.`)
                .setColor(client.color.main)
                .setTimestamp();
			return await ctx.reply({ embeds: [successEmbed] });
		}

		if (sub === 'delete') {
			if (role) await role.delete().catch(() => {});
			await client.prisma.customRole.delete({
				where: { guildId_userId: { guildId: ctx.guild.id, userId } }
			});
            const successEmbed = new EmbedBuilder()
                .setTitle(`${client.emoji.success} Role Deleted`)
                .setDescription('Successfully deleted your custom role.')
                .setColor(client.color.main)
                .setTimestamp();
			return await ctx.reply({ embeds: [successEmbed] });
		}
	}
}

