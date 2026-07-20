import { Command, Context } from '../../structures';
import { SendMessages, ReadMessageHistory, ViewChannel, EmbedLinks } from '../../utils/Permissions';
import { ExtendedClient } from '../../client';
import { EmbedBuilder, PermissionFlagsBits, Role } from 'discord.js';

export default class Roleinfo extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'roleinfo',
			aliases: ['ri'],
			description: {
				content: 'Get detailed information about a role including its permissions.',
				usage: 'roleinfo <role>',
				examples: ['roleinfo @Admin', 'ri Moderator'],
			},
			category: 'utility',
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: [SendMessages, ReadMessageHistory, ViewChannel, EmbedLinks],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'role',
					description: 'The role to inspect',
					type: 8,
					required: true,
				},
			],
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		await ctx.deferReply();

		let role: Role | null = null;

		if (ctx.interaction) {
			role = ctx.options.getRole('role') as Role;
		} else {
			const query = args.join(' ').trim();
			const roleId = query.replace(/[<@&>]/g, '');
			role = ctx.guild.roles.cache.get(roleId) ||
				ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === query.toLowerCase()) ||
				ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase().includes(query.toLowerCase())) ||
				null;
		}

		if (!role) {
			return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });
		}

		const keyPermissions: string[] = [];
		const permChecks: [bigint, string][] = [
			[PermissionFlagsBits.Administrator, 'Administrator'],
			[PermissionFlagsBits.ManageGuild, 'Manage Server'],
			[PermissionFlagsBits.ManageRoles, 'Manage Roles'],
			[PermissionFlagsBits.ManageChannels, 'Manage Channels'],
			[PermissionFlagsBits.ManageMessages, 'Manage Messages'],
			[PermissionFlagsBits.BanMembers, 'Ban Members'],
			[PermissionFlagsBits.KickMembers, 'Kick Members'],
			[PermissionFlagsBits.MentionEveryone, 'Mention Everyone'],
			[PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
			[PermissionFlagsBits.ManageWebhooks, 'Manage Webhooks'],
			[PermissionFlagsBits.ManageNicknames, 'Manage Nicknames'],
			[PermissionFlagsBits.ManageEmojisAndStickers, 'Manage Emojis & Stickers'],
			[PermissionFlagsBits.ViewAuditLog, 'View Audit Log'],
		];

		for (const [flag, label] of permChecks) {
			if (role.permissions.has(flag)) {
				keyPermissions.push(label);
			}
		}

		let permsString: string;
		if (role.permissions.has(PermissionFlagsBits.Administrator)) {
			permsString = 'Administrator (All Permissions)';
		} else if (keyPermissions.length > 0) {
			permsString = keyPermissions.join(', ');
		} else {
			permsString = 'None';
		}

		const createdTs = Math.floor(role.createdTimestamp / 1000);
		const thumbnail = role.iconURL({ size: 256 });

		const embed = new EmbedBuilder()
			.setTitle(role.name)
			.setColor(role.color || client.color.main)
			.addFields(
				{ name: 'ID', value: `\`${role.id}\``, inline: true },
				{ name: 'Color', value: `\`${role.hexColor}\``, inline: true },
				{ name: 'Position', value: `${role.position} / ${ctx.guild.roles.cache.size}`, inline: true },
				{ name: 'Mentionable', value: role.mentionable ? `${client.emoji.success} Yes` : `${client.emoji.cross} No`, inline: true },
				{ name: 'Hoisted', value: role.hoist ? `${client.emoji.success} Yes` : `${client.emoji.cross} No`, inline: true },
				{ name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
				{ name: 'Members', value: `${role.members.size}`, inline: true },
				{ name: 'Created', value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`, inline: true },
				{ name: 'Mention', value: `<@&${role.id}>`, inline: false },
				{ name: 'Key Permissions', value: permsString, inline: false },
			)
			.setTimestamp();

		if (thumbnail) {
			embed.setThumbnail(thumbnail);
		}

		return ctx.reply({ embeds: [embed] });
	}
}
