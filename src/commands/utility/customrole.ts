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
				},
				{
					name: 'icon',
					description: 'Set an icon for your custom role (Server Level 2+ required)',
					type: 1,
					options: [
						{ name: 'icon', description: 'Emoji (unicode) or Image URL for the role icon', type: 3, required: true }
					]
				},
				{
					name: 'rename',
					description: 'Rename your custom role',
					type: 1,
					options: [
						{ name: 'name', description: 'New name for the role', type: 3, required: true }
					]
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

		if (sub === 'icon') {
			if (!role) {
				const errorEmbed = new EmbedBuilder()
					.setTitle(' Role Lost')
					.setDescription('Your role was manually deleted from the server.')
					.setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}

			if (ctx.guild.premiumTier < 2) {
				const errorEmbed = new EmbedBuilder()
					.setTitle(' Boost Level Too Low')
					.setDescription('Server must be at least Boost Level 2 to set role icons.')
					.setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}

			const iconInput = ctx.options.getString('icon')!;
			try {
				const isUrl = iconInput.startsWith('http');
				await role.edit({
					icon: isUrl ? iconInput : undefined,
					unicodeEmoji: !isUrl ? iconInput : undefined
				}, `Custom role icon set by ${ctx.author.tag}`);

				const successEmbed = new EmbedBuilder()
					.setTitle(`${client.emoji.success} Role Icon Updated`)
					.setDescription(`Updated your custom role icon to ${isUrl ? 'a custom image' : iconInput}.`)
					.setColor(client.color.main)
					.setTimestamp();
				return await ctx.reply({ embeds: [successEmbed] });
			} catch (e: any) {
				const errorEmbed = new EmbedBuilder()
					.setTitle(' Error')
					.setDescription(`Failed to set icon: ${e.message}`)
					.setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}
		}

		if (sub === 'rename') {
			if (!role) {
				const errorEmbed = new EmbedBuilder()
					.setTitle(' Role Lost')
					.setDescription('Your role was manually deleted from the server.')
					.setColor(client.color.red);
				return await ctx.reply({ embeds: [errorEmbed], flags: [64] });
			}

			const newName = ctx.options.getString('name')!;
			await role.setName(newName, `Renamed by ${ctx.author.tag}`);

			const successEmbed = new EmbedBuilder()
				.setTitle(`${client.emoji.success} Role Renamed`)
				.setDescription(`Your custom role has been renamed to **${newName}**.`)
				.setColor(client.color.main)
				.setTimestamp();
			return await ctx.reply({ embeds: [successEmbed] });
		}
	}
}

