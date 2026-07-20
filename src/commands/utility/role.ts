import { EmbedBuilder, PermissionFlagsBits, GuildMember, Role } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';
import { addRainbowRole, removeRainbowRole, isRainbowRole } from '../../tasks/rainbowScheduler';

async function resolveImage(ctx: Context, argUrl?: string): Promise<string | null> {
    const msg = ctx.message;
    if (!msg) return argUrl || null;

    // 1. Check current message attachments
    const attachment = msg.attachments?.first();
    if (attachment && attachment.url) {
        return attachment.url;
    }

    // 2. Check reply message attachments/embeds
    if (msg.reference && msg.reference.messageId) {
        try {
            const repliedMsg = await msg.channel.messages.fetch(msg.reference.messageId);
            const repAttachment = repliedMsg.attachments?.first();
            if (repAttachment && repAttachment.url) {
                return repAttachment.url;
            }
            const repUrlMatch = repliedMsg.content?.match(/(https?:\/\/[^\s]+)/);
            if (repUrlMatch) {
                return repUrlMatch[1];
            }
            const embed = repliedMsg.embeds?.[0];
            const url = embed?.url || embed?.image?.url || embed?.thumbnail?.url;
            if (url) return url;
        } catch {}
    }

    // 3. Fallback to argument URL
    if (argUrl && argUrl.startsWith('http')) {
        return argUrl;
    }

    return null;
}

export default class RoleCommand extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'role',
			aliases: ['r'],
			description: {
				content: 'Manage server roles (add, remove, create, delete, color, icon, and view info).',
				usage: 'role <add/remove/create/delete/color/icon/info> [args]',
				examples: ['role add @Member @Admin', 'role create "New Role" #FF00FF 👑', 'role icon @Admin', 'role delete @Admin']
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
                    name: 'create',
                    description: 'Create a new role',
                    type: 1,
                    options: [
                        { name: 'name', description: 'The name of the role', type: 3, required: true },
                        { name: 'color', description: 'Hex code (e.g. #FF00FF)', type: 3, required: false },
                        { name: 'icon', description: 'Emoji or Image URL', type: 3, required: false }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Delete a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role to delete', type: 8, required: true }
                    ]
                },
                {
                    name: 'color',
                    description: 'Change the color of a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role', type: 8, required: true },
                        { name: 'value', description: 'Hex code, "rainbow", "gradient-rainbow", "random", or "reset"', type: 3, required: true },
                        { name: 'secondary_value', description: 'Secondary hex for gradient', type: 3, required: false },
                        { name: 'tertiary_value', description: 'Tertiary hex for holographic style', type: 3, required: false }
                    ]
                },
                {
                    name: 'icon',
                    description: 'Change the icon of a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role', type: 8, required: true },
                        { name: 'url_or_emoji', description: 'Image URL or Emoji', type: 3, required: false }
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
		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isOwner = BOT_OWNERS.has(ctx.author.id);

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

        if (!sub) return ctx.reply({ content: `Usage: \`${ctx.prefix}role <add/remove/create/delete/color/icon/info>\`` });

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
            
            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass (bot owners bypass this)
            if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role (bot owners bypass this)
            const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwner && !isOwner && role.position >= ctx.member!.roles.highest.position) {
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

        // Handle Create
        if (sub === 'create') {
            let name = '';
            let colorVal = '';
            let iconVal = '';

            if (ctx.interaction) {
                name = ctx.options.getString('name')!;
                colorVal = ctx.options.getString('color') || '';
                iconVal = ctx.options.getString('icon') || '';
            } else {
                const rawContent = ctx.message?.content || '';
                const createIndex = rawContent.toLowerCase().indexOf('create');
                const afterCreate = createIndex !== -1 ? rawContent.slice(createIndex + 6).trim() : '';

                if (afterCreate.includes(',')) {
                    const parts = afterCreate.split(',').map(p => p.trim());
                    name = parts[0];
                    if (parts.length === 2) {
                        const secondPart = parts[1];
                        const isHex = (str: string) => /^#?[0-9A-F]{6}$/i.test(str.replace('#', ''));
                        if (isHex(secondPart)) {
                            colorVal = secondPart;
                        } else {
                            iconVal = secondPart;
                        }
                    } else if (parts.length >= 3) {
                        colorVal = parts[1];
                        iconVal = parts[2];
                    }
                } else {
                    const createArgs = args.slice(1);
                    const isHex = (str: string) => /^#?[0-9A-F]{6}$/i.test(str.replace('#', ''));

                    if (createArgs.length >= 2) {
                        const lastArg = createArgs[createArgs.length - 1];
                        const secondLastArg = createArgs[createArgs.length - 2];

                        if (isHex(lastArg)) {
                            colorVal = lastArg;
                            name = createArgs.slice(0, -1).join(' ');
                        } else if (isHex(secondLastArg)) {
                            colorVal = secondLastArg;
                            iconVal = lastArg;
                            name = createArgs.slice(0, -2).join(' ');
                        } else {
                            // No hex detected at the end, treat entire command after create as the name
                            name = createArgs.join(' ');
                        }
                    } else if (createArgs.length === 1) {
                        name = createArgs[0];
                    }
                }
            }

            if (!name) {
                return ctx.reply({ content: `${client.emoji.cross} Please provide a name for the role.\n**Usage:** \`role create <name> [color] [icon]\` or \`role create <name with spaces>, [color], [icon]\`` });
            }

            let hexColor = 0;
            if (colorVal) {
                const hex = colorVal.replace('#', '');
                if (/^[0-9A-F]{6}$/i.test(hex)) {
                    hexColor = parseInt(hex, 16);
                }
            }

            try {
                const newRole = await ctx.guild.roles.create({
                    name: name,
                    color: hexColor,
                    reason: `Role created by ${ctx.author.tag}`
                });

                let iconUpdated = false;
                let iconError = '';

                // Resolve image from upload / replies / arguments
                const resolvedUrl = await resolveImage(ctx, iconVal);

                if (resolvedUrl || iconVal) {
                    if (ctx.guild.premiumTier < 2) {
                        iconError = ' (Server needs Level 2 Boost to set role icons)';
                    } else {
                        try {
                            if (resolvedUrl) {
                                await newRole.setIcon(resolvedUrl);
                                iconUpdated = true;
                            } else {
                                const customEmojiMatch = iconVal.match(/^<(a?):(\w+):(\d+)>$/);
                                if (customEmojiMatch) {
                                    const isAnimated = customEmojiMatch[1] === 'a';
                                    const emojiId = customEmojiMatch[3];
                                    const ext = isAnimated ? 'gif' : 'png';
                                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=128&quality=lossless`;
                                    await newRole.setIcon(emojiUrl);
                                    iconUpdated = true;
                                } else {
                                    await newRole.setUnicodeEmoji(iconVal);
                                    iconUpdated = true;
                                }
                            }
                        } catch (e: any) {
                            iconError = ` (Failed to set icon: ${e.message})`;
                        }
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('Role Created')
                    .setDescription(`Successfully created role **${newRole.name}** (<@&${newRole.id}>)${iconUpdated ? ' with custom icon' : ''}.${iconError}`)
                    .setColor(newRole.color || client.color.main)
                    .setTimestamp();

                return ctx.reply({ embeds: [embed] });
            } catch (err: any) {
                return ctx.reply({ content: `${client.emoji.cross} Failed to create role: ${err.message}` });
            }
        }

        // Handle Delete
        if (sub === 'delete') {
            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
            } else {
                if (args.length < 2) return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role delete <role/roleID>\`` });
                const roleQuery = args.slice(1).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!role) return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });

            // Developer restriction (bot owners bypass this)
            if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check (bot owners bypass this)
            const isGuildOwnerDelete = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerDelete && !isOwner && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot delete a role that is higher than or equal to your highest role.` });
            }

            // Bot Hierarchy Check
            if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} My role is too low to delete this role.` });
            }

            try {
                const roleName = role.name;
                await role.delete(`Role deleted by ${ctx.author.tag}`);
                return ctx.reply({ content: `${client.emoji.success} Successfully deleted role **${roleName}**.` });
            } catch (err: any) {
                return ctx.reply({ content: `${client.emoji.cross} Failed to delete role: ${err.message}` });
            }
        }

        // Handle Color
        if (sub === 'color') {
            let colorVals: string[] = [];
            let roleQuery = '';

            const isColorResolvable = (str: string) => {
                if (!str) return false;
                const clean = str.toLowerCase().replace('#', '');
                if (/^[0-9a-f]{6}$/i.test(clean)) return true;
                const commonColors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'cyan', 'white', 'black', 'gray', 'grey', 'gold', 'rainbow', 'gradient-rainbow', 'grainbow', 'random', 'reset'];
                return commonColors.includes(clean);
            };

            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
                const val = ctx.options.getString('value')!;
                const secVal = ctx.options.getString('secondary_value');
                const tertVal = ctx.options.getString('tertiary_value');
                colorVals.push(val);
                if (secVal) colorVals.push(secVal);
                if (tertVal) colorVals.push(tertVal);
            } else {
                const rawContent = ctx.message?.content || '';
                const colorIndex = rawContent.toLowerCase().indexOf('color');
                const afterColor = colorIndex !== -1 ? rawContent.slice(colorIndex + 5).trim() : '';

                if (afterColor.includes(',')) {
                    const parts = afterColor.split(',').map(p => p.trim());
                    roleQuery = parts[0];
                    colorVals = parts.slice(1).filter(p => isColorResolvable(p));
                } else {
                    const colorArgs = args.slice(1);
                    const collected: string[] = [];
                    let i = colorArgs.length - 1;
                    while (i >= 0 && isColorResolvable(colorArgs[i])) {
                        collected.push(colorArgs[i]);
                        i--;
                    }
                    if (collected.length > 0) {
                        colorVals = collected.reverse();
                        roleQuery = colorArgs.slice(0, i + 1).join(' ');
                    } else {
                        roleQuery = colorArgs.join(' ');
                    }
                }
                role = resolveRole(roleQuery);
            }

            if (!role || colorVals.length === 0) {
                return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role color <role> <color/random/rainbow/reset> [secondary_color] [tertiary_color]\` or \`${ctx.prefix}role color <role>, <color1>, <color2>\`` });
            }

            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass (bot owners bypass this)
            if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role (bot owners bypass this)
            const isGuildOwnerColor = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerColor && !isOwner && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot manage a role that is higher than or equal to your highest role.` });
            }

            if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} I cannot modify this role's color (Hierarchy).` });
            }

            const firstColor = colorVals[0].toLowerCase();

            if (firstColor === 'reset') {
                removeRainbowRole(role.id);
                await role.setColor(0);
                return ctx.reply({ content: `${client.emoji.success} Reset color for **${role.name}**.` });
            }

            if (firstColor === 'rainbow' || firstColor === 'gradient-rainbow' || firstColor === 'grainbow') {
                const isGradientRainbow = firstColor === 'gradient-rainbow' || firstColor === 'grainbow' || colorVals.length > 1;
                const type = isGradientRainbow ? 'gradient' : 'single';
                const added = addRainbowRole(ctx.guild.id, role.id, type);
                if (added) {
                    return ctx.reply({ content: `${client.emoji.success} Role **${role.name}** has been added to the **${type}** rainbow cycle! It will change colors every 30 seconds.` });
                } else {
                    return ctx.reply({ content: `${client.emoji.cross} Role **${role.name}** is already in the rainbow cycle.` });
                }
            }

            if (firstColor === 'random') {
                removeRainbowRole(role.id);
                const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

                if (colorVals.length > 1) {
                    const hex1 = randomHex();
                    const hex2 = randomHex();
                    try {
                        await role.setColors({
                            primaryColor: `#${hex1}`,
                            secondaryColor: `#${hex2}`
                        }, `Set random gradient color by ${ctx.author.tag}`);

                        const embed = new EmbedBuilder()
                            .setTitle(`Random Gradient Role Color`)
                            .setDescription(`${client.emoji.success} Set color of **${role.name}** to random gradient: \`#${hex1}\` ➔ \`#${hex2}\`.`)
                            .setColor(parseInt(hex1, 16));
                        return ctx.reply({ embeds: [embed] });
                    } catch (err: any) {
                        return ctx.reply({ content: `${client.emoji.cross} Failed to set gradient color: ${err.message}. (Gradients require Level 2 Server Boosts)` });
                    }
                } else {
                    const hex = randomHex();
                    await role.setColor(parseInt(hex, 16));
                    return ctx.reply({
                        embeds: [new EmbedBuilder().setColor(parseInt(hex, 16)).setDescription(`${client.emoji.success} Set color of **${role.name}** to a random color: \`#${hex}\`.`)]
                    });
                }
            }

            removeRainbowRole(role.id);

            const resolveColor = (val: string) => {
                const clean = val.replace('#', '');
                if (/^[0-9A-F]{6}$/i.test(clean)) {
                    return `#${clean}`;
                }
                return val;
            };

            try {
                if (colorVals.length === 1) {
                    const resolved = resolveColor(colorVals[0]);
                    await role.setColor(resolved as any);
                    const hexColor = role.hexColor;
                    return ctx.reply({
                        embeds: [new EmbedBuilder().setColor(resolved as any).setDescription(`${client.emoji.success} Set color of **${role.name}** to \`${hexColor}\`.`)]
                    });
                } else {
                    const primary = resolveColor(colorVals[0]);
                    const secondary = resolveColor(colorVals[1]);
                    const tertiary = colorVals[2] ? resolveColor(colorVals[2]) : undefined;

                    await role.setColors({
                        primaryColor: primary as any,
                        secondaryColor: secondary as any,
                        tertiaryColor: tertiary as any
                    }, `Set gradient/holographic colors by ${ctx.author.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle(`Gradient Role Color Applied`)
                        .setDescription(`${client.emoji.success} Set color of **${role.name}** to gradient: \`${primary}\` ➔ \`${secondary}\`${tertiary ? ` ➔ \`${tertiary}\`` : ''}.`)
                        .setColor(primary as any);
                    return ctx.reply({ embeds: [embed] });
                }
            } catch (err: any) {
                return ctx.reply({ content: `${client.emoji.cross} Failed to set color: ${err.message}. (Gradients require Level 2 Server Boosts)` });
            }
        }

        // Handle Icon
        if (sub === 'icon') {
            let iconVal: string = '';
            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
                iconVal = ctx.options.getString('url_or_emoji') || '';
            } else {
                if (args.length >= 3) {
                    iconVal = args[args.length - 1];
                    const roleQuery = args.slice(1, args.length - 1).join(' ');
                    role = resolveRole(roleQuery);
                } else if (args.length === 2) {
                    const roleQuery = args[1];
                    role = resolveRole(roleQuery);
                } else {
                    return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role icon <role> [url/emoji]\`` });
                }
            }

            if (!role) return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });

            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass (bot owners bypass this)
            if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role (bot owners bypass this)
            const isGuildOwnerIcon = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerIcon && !isOwner && role.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot manage a role that is higher than or equal to your highest role.` });
            }

            if (ctx.guild.premiumTier < 2) {
                return ctx.reply({ content: `${client.emoji.cross} This server needs Level 2 Boost to use role icons.` });
            }

            const resolvedUrl = await resolveImage(ctx, iconVal);
            if (!resolvedUrl && !iconVal) {
                return ctx.reply({ content: `${client.emoji.cross} Please provide an image (upload/reply) or emoji/URL.` });
            }

            try {
                if (resolvedUrl) {
                    await role.setIcon(resolvedUrl);
                } else {
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
                        await role.setUnicodeEmoji(iconVal);
                    }
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
