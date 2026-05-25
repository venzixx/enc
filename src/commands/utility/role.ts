import { EmbedBuilder, PermissionFlagsBits, GuildMember, Role } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';

export default class RoleCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'role',
			aliases: ['r'],
			description: {
				content: 'Add/remove a role from a member or view role info.',
				usage: 'role <add/remove/color/icon/info> [args]',
				examples: ['role add @Member @Admin', 'role info @Admin']
			},
			category: 'tools',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [],
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
				},
                {
                    name: 'color',
                    description: 'Change the color of a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role', type: 8, required: true },
                        { name: 'value', description: 'Hex code (e.g. #FF00FF) or "rainbow" or "reset"', type: 3, required: true },
                        { name: 'secondary_value', description: 'Secondary hex for gradient (simulated)', type: 3, required: false }
                    ]
                },
                {
                    name: 'icon',
                    description: 'Change the icon of a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role', type: 8, required: true },
                        { name: 'url_or_emoji', description: 'Image URL or Emoji', type: 3, required: true }
                    ]
                },
                {
                    name: 'info',
                    description: 'Get information about a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role', type: 8, required: true }
                    ]
                }
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		// Check authorization: User must have MANAGE_ROLES permission OR be a registered developer
		const hasPerm = ctx.member?.permissions.has(PermissionFlagsBits.ManageRoles);
		const developer = await isDev(client, ctx.author.id);

		if (!hasPerm && !developer) {
			return ctx.reply({ content: `${client.emoji.cross} You do not have permission to use this command.` });
		}

		let sub: string | null = null;
		let target: GuildMember | null = null;
		let role: Role | null = null;

		if (ctx.interaction) {
			await ctx.deferReply();
			sub = ctx.options.getSubcommand();
		} else {
			sub = args[0]?.toLowerCase();
		}

        if (!sub) return ctx.reply({ content: `Usage: \`${ctx.prefix}role <add/remove/color/icon/info>\`` });

        // Helper to resolve role by ID, exact name, or partial name
        const resolveRole = (query: string): Role | null => {
            if (!query) return null;
            const clean = query.trim();
            const roleId = clean.replace(/[<@&>]/g, '');
            return ctx.guild.roles.cache.get(roleId) || 
                   ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase() === clean.toLowerCase()) ||
                   ctx.guild.roles.cache.find((r: any) => r.name.toLowerCase().includes(clean.toLowerCase())) ||
                   null;
        };

        // Handle Add/Remove
        if (sub === 'add' || sub === 'remove') {
            if (ctx.interaction) {
                target = ctx.options.getMember('user') as GuildMember;
                role = ctx.options.getRole('role') as Role;
            } else {
                target = await Resolver.resolveMember(ctx, args[1]);
                const roleQuery = args.slice(2).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!target || !role) return ctx.reply({ content: `${client.emoji.cross} Could not find that member or role.` });
            
            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass
            if (developer && !hasPerm && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role
            const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwner && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot manage a role that is higher than or equal to your highest role.` });
            }
            
            // Hierarchy Check (Bot)
            if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} My role is too low to manage this role.` });
            }

            if (sub === 'add') {
                await target.roles.add(role);
                return ctx.reply({ content: `${client.emoji.success} Added ${role.name} to **${target.user.tag}**.` });
            } else {
                await target.roles.remove(role);
                return ctx.reply({ content: `${client.emoji.success} Removed ${role.name} from **${target.user.tag}**.` });
            }
        }

        // Handle Color
        if (sub === 'color') {
            let colorVal: string;
            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
                colorVal = ctx.options.getString('value')!;
            } else {
                if (args.length < 3) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role color <role> <hex/rainbow/reset>\`` });
                colorVal = args[args.length - 1]?.toLowerCase();
                const roleQuery = args.slice(1, args.length - 1).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!role || !colorVal) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role color <role> <hex/rainbow/reset>\`` });

            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass
            if (developer && !hasPerm && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role
            const isGuildOwnerColor = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerColor && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot manage a role that is higher than or equal to your highest role.` });
            }

            if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} I cannot modify this role's color (Hierarchy).` });
            }

            if (colorVal === 'reset') {
                await role.setColor(0);
                return ctx.reply({ content: `${client.emoji.success} Reset color for **${role.name}**.` });
            }

            if (colorVal === 'rainbow') {
                // Future: Add to background task
                return ctx.reply({ content: `${client.emoji.success} Role **${role.name}** has been added to the rainbow cycle! (Simulated)` });
            }

            const hex = colorVal.replace('#', '');
            if (!/^[0-9A-F]{6}$/i.test(hex)) return ctx.reply({ content: `${client.emoji.cross} Invalid hex color.` });

            await role.setColor(parseInt(hex, 16));
            return ctx.reply({ 
                embeds: [new EmbedBuilder().setColor(parseInt(hex, 16)).setDescription(`${client.emoji.success} Set color of **${role.name}** to \`#${hex}\`.`)] 
            });
        }

        // Handle Icon
        if (sub === 'icon') {
            let iconVal: string;
            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
                iconVal = ctx.options.getString('url_or_emoji')!;
            } else {
                if (args.length < 3) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role icon <role> <url/emoji>\`` });
                iconVal = args[args.length - 1];
                const roleQuery = args.slice(1, args.length - 1).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!role || !iconVal) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role icon <role> <url/emoji>\`` });

            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass
            if (developer && !hasPerm && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role
            const isGuildOwnerIcon = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerIcon && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot manage a role that is higher than or equal to your highest role.` });
            }

            if (ctx.guild.premiumTier < 2) {
                return ctx.reply({ content: `${client.emoji.cross} This server needs Level 2 Boost to use role icons.` });
            }

            try {
                // Check if it's a custom emoji like <:name:id> or <a:name:id>
                const customEmojiMatch = iconVal.match(/^<(a?):(\w+):(\d+)>$/);
                if (customEmojiMatch) {
                    const isAnimated = customEmojiMatch[1] === 'a';
                    const emojiId = customEmojiMatch[3];
                    const ext = isAnimated ? 'gif' : 'png';
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=128&quality=lossless`;
                    await role.setIcon(emojiUrl);
                } else if (iconVal.startsWith('http')) {
                    await role.setIcon(iconVal);
                } else {
                    // Treat as unicode emoji
                    await role.setUnicodeEmoji(iconVal);
                }
                return ctx.reply({ content: `${client.emoji.success} Updated icon for **${role.name}**.` });
            } catch (e: any) {
                return ctx.reply({ content: `${client.emoji.cross} Failed to set icon: ${e.message}` });
            }
        }

        // Handle Info
        if (sub === 'info') {
            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
            } else {
                if (args.length < 2) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role info <role>\`` });
                const roleQuery = args.slice(1).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!role) return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });

            const keyPermissions: string[] = [];
            if (role.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
            if (role.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
            if (role.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
            if (role.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
            if (role.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
            if (role.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
            if (role.permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('Manage Messages');
            if (role.permissions.has(PermissionFlagsBits.MentionEveryone)) keyPermissions.push('Mention Everyone');
            if (role.permissions.has(PermissionFlagsBits.ModerateMembers)) keyPermissions.push('Timeout Members');

            const permsString = keyPermissions.length > 0 ? keyPermissions.join(', ') : 'None';

            const embed = new EmbedBuilder()
                .setTitle(`Role Info: ${role.name}`)
                .setColor(role.color || client.color.main)
                .addFields(
                    { name: 'Role Name', value: `${role}`, inline: true },
                    { name: 'Role ID', value: `\`${role.id}\``, inline: true },
                    { name: 'Position', value: `${role.position} (out of ${ctx.guild.roles.cache.size})`, inline: true },
                    { name: 'Hex Color', value: `\`${role.hexColor}\``, inline: true },
                    { name: 'Mentionable', value: role.mentionable ? `${client.emoji.success} Yes` : `${client.emoji.cross} No`, inline: true },
                    { name: 'Hoisted', value: role.hoist ? `${client.emoji.success} Yes` : `${client.emoji.cross} No`, inline: true },
                    { name: 'Members', value: `${role.members.size}`, inline: true },
                    { name: 'Created At', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D> (<t:${Math.floor(role.createdTimestamp / 1000)}:R>)`, inline: true },
                    { name: 'Key Permissions', value: permsString, inline: false }
                )
                .setTimestamp();

            return ctx.reply({ embeds: [embed] });
        }
	}
}
