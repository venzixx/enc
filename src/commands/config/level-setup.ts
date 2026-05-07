import { EmbedBuilder, PermissionFlagsBits, ChannelType, ApplicationCommandOptionType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class LevelSetup extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'level-setup',
			description: {
				content: 'Configure the XP and Leveling system settings.',
				usage: 'level-setup <subcommand>',
				examples: ['level-setup channel #levels', 'level-setup booster add @VIP 50']
			},
			category: 'config',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.Administrator],
				client: [PermissionFlagsBits.Administrator]
			},
			options: [
				{
					name: 'channel',
					description: 'Set the channel for level-up messages',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'target',
							description: 'The channel for level-up messages',
							type: ApplicationCommandOptionType.Channel,
							required: true,
							channel_types: [ChannelType.GuildText]
						}
					]
				},
				{
					name: 'card-channel',
					description: 'Set the channel where rank cards will be sent',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'target',
							description: 'The channel for rank cards',
							type: ApplicationCommandOptionType.Channel,
							required: true,
							channel_types: [ChannelType.GuildText]
						}
					]
				},
				{
					name: 'booster',
					description: 'Manage XP booster roles',
					type: ApplicationCommandOptionType.SubcommandGroup,
					options: [
						{
							name: 'add',
							description: 'Add a booster role',
							type: ApplicationCommandOptionType.Subcommand,
							options: [
								{ name: 'role', description: 'The role to boost', type: ApplicationCommandOptionType.Role, required: true },
								{ name: 'percentage', description: 'XP boost percentage (e.g. 50 for 1.5x)', type: ApplicationCommandOptionType.Integer, required: true, min_value: 1, max_value: 500 }
							]
						},
						{
							name: 'remove',
							description: 'Remove a booster role',
							type: ApplicationCommandOptionType.Subcommand,
							options: [
								{ name: 'role', description: 'The role to remove', type: ApplicationCommandOptionType.Role, required: true }
							]
						},
						{
							name: 'list',
							description: 'List all booster roles',
							type: ApplicationCommandOptionType.Subcommand
						}
					]
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
		const sub = ctx.options.getSubcommand();
		const group = ctx.options.getSubcommandGroup(false);

		if (sub === 'channel') {
			const channel = ctx.options.getChannel('target', true);
			await client.prisma.guild.upsert({
				where: { id: ctx.guild.id },
				update: { levelUpChannelId: channel.id },
				create: { id: ctx.guild.id, levelUpChannelId: channel.id }
			});
			return ctx.replyV2({ description: `${client.emoji.success} Level-up notifications will now be sent in ${channel}.` });
		}

		if (sub === 'card-channel') {
			const channel = ctx.options.getChannel('target', true);
			await client.prisma.guild.upsert({
				where: { id: ctx.guild.id },
				update: { rankCardChannelId: channel.id },
				create: { id: ctx.guild.id, rankCardChannelId: channel.id }
			});
			return ctx.replyV2({ description: `${client.emoji.success} Rank cards will now be sent in ${channel}.` });
		}

		if (group === 'booster') {
			if (sub === 'add') {
				const role = ctx.options.getRole('role', true);
				const percentage = ctx.options.getInteger('percentage', true);

				await client.prisma.roleBooster.upsert({
					where: { guildId_roleId: { guildId: ctx.guild.id, roleId: role.id } },
					update: { percentage },
					create: { guildId: ctx.guild.id, roleId: role.id, percentage }
				});

				return ctx.replyV2({ description: `${client.emoji.success} Added **${percentage}%** XP boost to ${role}.` });
			}

			if (sub === 'remove') {
				const role = ctx.options.getRole('role', true);
				await client.prisma.roleBooster.delete({
					where: { guildId_roleId: { guildId: ctx.guild.id, roleId: role.id } }
				}).catch(() => {});

				return ctx.replyV2({ description: `${client.emoji.success} Removed XP boost from ${role}.` });
			}

			if (sub === 'list') {
				const boosters = await client.prisma.roleBooster.findMany({
					where: { guildId: ctx.guild.id }
				});

				if (boosters.length === 0) {
					return ctx.replyV2({ description: 'No XP booster roles configured.', isAlert: true });
				}

				const embed = new EmbedBuilder()
					.setTitle('XP Booster Roles')
					.setColor(client.color.main)
					.setDescription(boosters.map(b => `<@&${b.roleId}>: **+${b.percentage}%** XP`).join('\n'));

				return ctx.reply({ embeds: [embed] });
			}
		}
	}
}

