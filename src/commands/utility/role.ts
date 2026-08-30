import { EmbedBuilder, PermissionFlagsBits, GuildMember, Role, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { isDev } from '../../utils/devCheck';
import { V2Helper } from '../../utils/V2Helper';
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
			aliases: ['r', 'rl'],
			description: {
				content: 'Manage server roles (add, remove, create, delete, color, icon, info, exch, rename, strip, and move).',
				usage: 'role <add/remove/create/delete/color/icon/info/exch/rename/strip/move> [args]',
				examples: ['role add @Member @Admin', 'role move @VIP 3', 'role strip @User', 'role exch @RoleA , @RoleB', 'role rename @VIP VIP Member', 'role color @Admin #FF00FF']
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
                },
                {
                    name: 'exch',
                    description: 'Exchange/swap members between two roles (or for a specific user)',
                    type: 1,
                    options: [
                        { name: 'role1', description: 'First role', type: 8, required: true },
                        { name: 'role2', description: 'Second role', type: 8, required: true },
                        { name: 'user', description: 'Specific member to exchange roles on (omit for server-wide exchange)', type: 6, required: false }
                    ]
                },
                {
                    name: 'rename',
                    description: 'Rename a role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role to rename', type: 8, required: true },
                        { name: 'name', description: 'The new name for the role', type: 3, required: true }
                    ]
                },
                {
                    name: 'inrole',
                    description: 'View members with a specific role',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role to check', type: 8, required: true }
                    ]
                },
                {
                    name: 'strip',
                    description: 'Strip all dangerous and staff permissions/roles from a member (Admin only)',
                    type: 1,
                    options: [
                        { name: 'user', description: 'The member to strip dangerous roles from', type: 6, required: true }
                    ]
                },
                {
                    name: 'move',
                    description: 'Move a role to a specific numbered position in the role hierarchy',
                    type: 1,
                    options: [
                        { name: 'role', description: 'The role to move', type: 8, required: true },
                        { name: 'position', description: 'Target position number (from ,roles list)', type: 4, required: true }
                    ]
                }
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		try {
			// Check authorization: User must have MANAGE_ROLES permission OR be a registered developer
			const hasPerm = ctx.member?.permissions.has(PermissionFlagsBits.ManageRoles);
			const developer = await isDev(client, ctx.author.id);
			const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
			const isOwner = BOT_OWNERS.has(ctx.author.id);
			const hasAdmin = ctx.member?.permissions.has(PermissionFlagsBits.Administrator) || ctx.author.id === ctx.guild.ownerId || isOwner;

			if (!hasPerm && !developer && !hasAdmin) {
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

			if (!sub) return ctx.reply({ content: `Usage: \`${ctx.prefix}role <add/remove/create/delete/color/icon/info/inrole/exch/rename>\`` });

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
            const isAll = !ctx.interaction && (args[1]?.toLowerCase() === 'all' || args[1]?.toLowerCase() === 'everyone');

            if (isAll) {
                const roleQuery = args.slice(2).join(' ');
                role = resolveRole(roleQuery);

                if (!role) {
                    return await ctx.replyV2({ 
                        description: `${client.emoji.cross || '❌'} Could not find that role.\n\n**Usage:** \`${ctx.prefix || ','}r ${sub} all <@role|roleName>\``, 
                        borderless: true 
                    });
                }

                // Developer / Hierarchy checks
                if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                    return await ctx.replyV2({ 
                        description: `${client.emoji.cross || '❌'} Developer bypass is not allowed to manage roles with Administrator permissions.`, 
                        borderless: true 
                    });
                }

                const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
                if (!isGuildOwner && !isOwner && role.position >= ctx.member!.roles.highest.position) {
                    return await ctx.replyV2({ 
                        description: `${client.emoji.cross || '❌'} You cannot manage a role that is higher than or equal to your highest role.`, 
                        borderless: true 
                    });
                }

                if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                    return await ctx.replyV2({ 
                        description: `${client.emoji.cross || '❌'} My role is too low to manage this role in the hierarchy.`, 
                        borderless: true 
                    });
                }

                // Fetch members
                await ctx.guild.members.fetch().catch(() => {});
                const allMembers: any[] = Array.from(ctx.guild.members.cache.values()).filter((m: any) => !m.user?.bot);
                const targetMembers: any[] = sub === 'add'
                    ? allMembers.filter((m: any) => !m.roles?.cache?.has(role!.id))
                    : allMembers.filter((m: any) => m.roles?.cache?.has(role!.id));

                if (targetMembers.length === 0) {
                    return await ctx.replyV2({
                        description: `${client.emoji.info || 'ℹ️'} All members ${sub === 'add' ? 'already have' : 'already do not have'} the <@&${role.id}> role.`,
                        borderless: true
                    });
                }

                // Build confirmation buttons
                const confirmBtn = new ButtonBuilder()
                    .setCustomId(`role_all_confirm_${ctx.author.id}`)
                    .setLabel(`Confirm ${sub === 'add' ? 'Add' : 'Remove'}`)
                    .setStyle(sub === 'add' ? ButtonStyle.Success : ButtonStyle.Danger);

                const cancelBtn = new ButtonBuilder()
                    .setCustomId(`role_all_cancel_${ctx.author.id}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary);

                const confirmLayout = V2Helper.createLayout({
                    title: "⚠️ Confirmation Required",
                    description: `Are you sure you want to **${sub.toUpperCase()}** <@&${role.id}> ${sub === 'add' ? 'to' : 'from'} **${targetMembers.length}** members in **${ctx.guild.name}**?\n\n*Click **Confirm** to proceed or **Cancel** to abort.*`,
                    footer: "Encl Role Management",
                    timestamp: true,
                    buttons: [confirmBtn, cancelBtn],
                    borderless: true
                });

                const replyMsg = await ctx.reply(confirmLayout as any);

                // Setup Collector
                const channel = ctx.channel;

                const collector = channel?.createMessageComponentCollector({
                    filter: (i: any) => i.customId.startsWith('role_all_') && i.user.id === ctx.author.id,
                    time: 60000,
                    max: 1
                });

                collector?.on('collect', async (i: any) => {
                    if (i.customId.startsWith('role_all_cancel_')) {
                        const cancelLayout = V2Helper.createLayout({
                            title: "❌ Operation Cancelled",
                            description: `The mass role operation for <@&${role!.id}> was cancelled.`,
                            footer: "Encl Role Management",
                            timestamp: true,
                            borderless: true
                        });
                        await i.update(cancelLayout as any).catch(() => {});
                        return;
                    }

                    if (i.customId.startsWith('role_all_confirm_')) {
                        const progressLayout = V2Helper.createLayout({
                            title: "⏳ Processing Mass Role Operation",
                            description: `Applying <@&${role!.id}> ${sub === 'add' ? 'to' : 'from'} **${targetMembers.length}** members...\n*Processing background queue...*`,
                            footer: "Encl Role Management",
                            timestamp: true,
                            borderless: true
                        });
                        await i.update(progressLayout as any).catch(() => {});

                        let successCount = 0;
                        let failCount = 0;

                        for (const member of targetMembers as GuildMember[]) {
                            try {
                                if (sub === 'add') {
                                    await (member as GuildMember).roles.add(role!.id, `Mass role add by ${ctx.author.tag}`);
                                } else {
                                    await (member as GuildMember).roles.remove(role!.id, `Mass role remove by ${ctx.author.tag}`);
                                }
                                successCount++;
                            } catch {
                                failCount++;
                            }
                            // Rate limit protection delay
                            await new Promise(r => setTimeout(r, 60));
                        }

                        const doneLayout = V2Helper.createLayout({
                            title: `✅ Mass Role ${sub === 'add' ? 'Addition' : 'Removal'} Complete`,
                            description: `Successfully **${sub === 'add' ? 'added' : 'removed'}** <@&${role!.id}> ${sub === 'add' ? 'to' : 'from'} **${successCount}** members.${failCount > 0 ? ` (${failCount} failed)` : ''}`,
                            footer: "Encl Role Management",
                            timestamp: true,
                            borderless: true
                        });

                        if (replyMsg && (replyMsg as any).edit) {
                            await (replyMsg as any).edit(doneLayout as any).catch(() => {});
                        } else {
                            await i.editReply(doneLayout as any).catch(() => {});
                        }
                    }
                });

                collector?.on('end', async (collected: any) => {
                    if (collected.size === 0) {
                        const timeoutLayout = V2Helper.createLayout({
                            title: "⏱️ Confirmation Timed Out",
                            description: `The mass role confirmation for <@&${role!.id}> timed out and was cancelled.`,
                            footer: "Encl Role Management",
                            timestamp: true,
                            borderless: true
                        });
                        if (replyMsg && (replyMsg as any).edit) {
                            await (replyMsg as any).edit(timeoutLayout as any).catch(() => {});
                        }
                    }
                });

                return;
            }

            // Normal single target resolution
            if (ctx.interaction) {
                target = ctx.options.getMember('user') as GuildMember;
                role = ctx.options.getRole('role') as Role;
            } else {
                target = await Resolver.resolveMember(ctx, args[1]);
                const roleQuery = args.slice(2).join(' ');
                role = resolveRole(roleQuery);
            }

            if (!target || !role) {
                return await ctx.replyV2({ 
                    description: `${client.emoji.cross || '❌'} Could not find that member or role.\n\n**Usage:** \`${ctx.prefix || ','}r ${sub} <@user|all> <@role>\``, 
                    borderless: true 
                });
            }
            
            // Developer restriction: Cannot manage roles with Administrator permissions if they only have developer bypass (bot owners bypass this)
            if (developer && !hasPerm && !isOwner && role.permissions.has(PermissionFlagsBits.Administrator)) {
                return await ctx.replyV2({ 
                    description: `${client.emoji.cross || '❌'} Developer bypass is not allowed to manage roles with Administrator permissions.`, 
                    borderless: true 
                });
            }

            // User Hierarchy Check: Cannot manage roles higher than or equal to caller's highest role (bot owners bypass this)
            const isGuildOwner = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwner && !isOwner && role.position >= ctx.member!.roles.highest.position) {
                return await ctx.replyV2({ 
                    description: `${client.emoji.cross || '❌'} You cannot manage a role that is higher than or equal to your highest role.`, 
                    borderless: true 
                });
            }
            
            // Hierarchy Check (Bot)
            if (role.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return await ctx.replyV2({ 
                    description: `${client.emoji.cross || '❌'} My role is too low to manage this role.`, 
                    borderless: true 
                });
            }

            if (sub === 'add') {
                await target.roles.add(role);
                return await ctx.replyV2({ 
                    description: `${client.emoji.success || '✅'} Added <@&${role.id}> to **${target.user.tag}**.`, 
                    borderless: true 
                });
            } else {
                await target.roles.remove(role);
                return await ctx.replyV2({ 
                    description: `${client.emoji.success || '✅'} Removed <@&${role.id}> from **${target.user.tag}**.`, 
                    borderless: true 
                });
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

        // Handle Exch / Swap / Exchange
        if (sub === 'exch' || sub === 'swap' || sub === 'exchange') {
            let targetMember: GuildMember | null = null;
            let role1: Role | null = null;
            let role2: Role | null = null;
            let isServerWide = false;

            if (ctx.interaction) {
                targetMember = ctx.options.getMember('user') as GuildMember | null;
                role1 = ctx.options.getRole('role1') as Role;
                role2 = ctx.options.getRole('role2') as Role;
                isServerWide = !targetMember;
            } else {
                // Check if first arg or user mention is a GuildMember
                const firstArg = args[1];
                let memberArg: GuildMember | null = null;

                if (ctx.message?.mentions.members && ctx.message.mentions.members.size > 0) {
                    memberArg = ctx.message.mentions.members.first()!;
                } else if (firstArg && !['all', 'server', 'everyone'].includes(firstArg.toLowerCase())) {
                    memberArg = await Resolver.resolveMember(ctx, firstArg);
                }

                if (memberArg) {
                    targetMember = memberArg;
                    // Filter out member mention / ID from args
                    const rawRolesString = args.slice(1).filter(a => {
                        const cleanA = a.replace(/[<@!>]*/g, '');
                        return cleanA !== memberArg!.id && cleanA !== memberArg!.user.id;
                    }).join(' ').trim();

                    if (rawRolesString.includes(',')) {
                        const parts = rawRolesString.split(',').map(p => p.trim());
                        role1 = resolveRole(parts[0]);
                        role2 = resolveRole(parts[1]);
                    } else {
                        const roleMentions = ctx.message?.mentions.roles;
                        if (roleMentions && roleMentions.size >= 2) {
                            const arr = Array.from(roleMentions.values());
                            role1 = arr[0];
                            role2 = arr[1];
                        } else {
                            const rArgs = rawRolesString.split(/\s+/).filter(Boolean);
                            if (rArgs.length >= 2) {
                                role1 = resolveRole(rArgs[0]);
                                role2 = resolveRole(rArgs.slice(1).join(' '));
                                if (!role1 || !role2) {
                                    const mid = Math.floor(rArgs.length / 2);
                                    role1 = resolveRole(rArgs.slice(0, mid).join(' '));
                                    role2 = resolveRole(rArgs.slice(mid).join(' '));
                                }
                            }
                        }
                    }
                } else {
                    const firstWord = args[1]?.toLowerCase();
                    if (firstWord === 'all' || firstWord === 'server' || firstWord === 'everyone') {
                        isServerWide = true;
                        const rawAfterExch = args.slice(2).join(' ').trim();
                        if (rawAfterExch.includes(',')) {
                            const parts = rawAfterExch.split(',').map(p => p.trim());
                            role1 = resolveRole(parts[0]);
                            role2 = resolveRole(parts[1]);
                        } else {
                            const mentions = ctx.message?.mentions.roles;
                            if (mentions && mentions.size >= 2) {
                                const arr = Array.from(mentions.values());
                                role1 = arr[0];
                                role2 = arr[1];
                            } else {
                                const exchArgs = args.slice(2);
                                if (exchArgs.length >= 2) {
                                    role1 = resolveRole(exchArgs[0]);
                                    role2 = resolveRole(exchArgs.slice(1).join(' '));
                                    if (!role1 || !role2) {
                                        const mid = Math.floor(exchArgs.length / 2);
                                        role1 = resolveRole(exchArgs.slice(0, mid).join(' '));
                                        role2 = resolveRole(exchArgs.slice(mid).join(' '));
                                    }
                                }
                            }
                        }
                    } else {
                        // Guard: User did not specify member and did not type 'all'
                        return ctx.reply({
                            content: `${client.emoji.cross} **Please specify a target member or use \`all\` for a server-wide exchange:**\n\n` +
                                `• **Single User Swap:** \`${ctx.prefix}role exch @User <role1> , <role2>\`\n` +
                                `• **Entire Server Swap:** \`${ctx.prefix}role exch all <role1> , <role2>\``
                        });
                    }
                }
            }

            if (!role1 || !role2) {
                return ctx.reply({ content: `${client.emoji.cross} Please specify two valid roles to exchange.\n**Usage:** \`${ctx.prefix}role exch @User <role1> , <role2>\` or \`${ctx.prefix}role exch all <role1> , <role2>\`` });
            }

            if (role1.id === role2.id) {
                return ctx.reply({ content: `${client.emoji.cross} Cannot exchange a role with itself.` });
            }

            // Developer / Hierarchy checks
            if (developer && !hasPerm && !isOwner && (role1.permissions.has(PermissionFlagsBits.Administrator) || role2.permissions.has(PermissionFlagsBits.Administrator))) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            const isGuildOwnerExch = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerExch && !isOwner) {
                if (role1.position >= ctx.member!.roles.highest.position) {
                    return ctx.reply({ content: `${client.emoji.cross} You cannot exchange role **${role1.name}** because it is higher than or equal to your highest role.` });
                }
                if (role2.position >= ctx.member!.roles.highest.position) {
                    return ctx.reply({ content: `${client.emoji.cross} You cannot exchange role **${role2.name}** because it is higher than or equal to your highest role.` });
                }
            }

            const mePosExch = (ctx.guild.members.me as GuildMember).roles.highest.position;
            if (role1.position >= mePosExch || role2.position >= mePosExch) {
                return ctx.reply({ content: `${client.emoji.cross} My role is too low to manage one of these roles.` });
            }

            if (targetMember) {
                // Exchange roles on target member
                const hasRole1 = targetMember.roles.cache.has(role1.id);
                const hasRole2 = targetMember.roles.cache.has(role2.id);

                if (hasRole1) {
                    await targetMember.roles.remove(role1).catch(() => {});
                    await targetMember.roles.add(role2).catch(() => {});
                } else if (hasRole2) {
                    await targetMember.roles.remove(role2).catch(() => {});
                    await targetMember.roles.add(role1).catch(() => {});
                } else {
                    await targetMember.roles.add(role2).catch(() => {});
                }

                const embed = new EmbedBuilder()
                    .setTitle('Member Roles Exchanged')
                    .setDescription(`${client.emoji.success} Successfully exchanged roles for **${targetMember.user.tag}**:\nSwapped **${role1.name}** (<@&${role1.id}>) ➔ **${role2.name}** (<@&${role2.id}>).`)
                    .setColor(client.color.main)
                    .setTimestamp();

                return ctx.reply({ embeds: [embed] });
            } else {
                // Server-wide member swap between role1 and role2
                await ctx.guild.members.fetch().catch(() => {});

                const members1 = Array.from(role1.members.values());
                const members2 = Array.from(role2.members.values());

                let count = 0;
                for (const m of members1) {
                    if (!m.roles.cache.has(role2.id)) {
                        await m.roles.add(role2).catch(() => {});
                        await m.roles.remove(role1).catch(() => {});
                        count++;
                    }
                }
                for (const m of members2) {
                    if (!m.roles.cache.has(role1.id)) {
                        await m.roles.add(role1).catch(() => {});
                        await m.roles.remove(role2).catch(() => {});
                        count++;
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('Server Roles Exchanged')
                    .setDescription(`${client.emoji.success} Successfully exchanged members between **${role1.name}** (<@&${role1.id}>) and **${role2.name}** (<@&${role2.id}>).\nUpdated **${count}** members.`)
                    .setColor(client.color.main)
                    .setTimestamp();

                return ctx.reply({ embeds: [embed] });
            }
        }

        // Handle Rename / Name
        if (sub === 'rename' || sub === 'name') {
            let roleToRename: Role | null = null;
            let newName = '';

            if (ctx.interaction) {
                roleToRename = ctx.options.getRole('role') as Role;
                newName = ctx.options.getString('name')!;
            } else {
                const rawAfterRename = args.slice(1).join(' ').trim();
                if (rawAfterRename.includes(',')) {
                    const parts = rawAfterRename.split(',').map(p => p.trim());
                    roleToRename = resolveRole(parts[0]);
                    newName = parts.slice(1).join(', ').trim();
                } else {
                    const mentions = ctx.message?.mentions.roles;
                    if (mentions && mentions.size > 0) {
                        roleToRename = mentions.first()!;
                        newName = args.slice(1).filter(a => !a.includes(roleToRename!.id)).join(' ').trim();
                    } else if (args.length >= 3) {
                        roleToRename = resolveRole(args[1]);
                        newName = args.slice(2).join(' ').trim();
                    } else if (args.length === 2) {
                        roleToRename = resolveRole(args[1]);
                    }
                }
            }

            if (!roleToRename || !newName) {
                return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role rename <role> <new_name>\` or \`${ctx.prefix}r rename @Role , New Name\`` });
            }

            if (developer && !hasPerm && !isOwner && roleToRename.permissions.has(PermissionFlagsBits.Administrator)) {
                return ctx.reply({ content: `${client.emoji.cross} Developer bypass is not allowed to manage roles with Administrator permissions.` });
            }

            const isGuildOwnerRename = ctx.author.id === ctx.guild.ownerId;
            if (!isGuildOwnerRename && !isOwner && roleToRename.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot rename a role higher than or equal to your highest role.` });
            }
            if (roleToRename.position >= (ctx.guild.members.me as GuildMember).roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} My role is too low to rename this role.` });
            }

            const oldName = roleToRename.name;
            try {
                await roleToRename.setName(newName, `Renamed by ${ctx.author.tag}`);
                return ctx.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Role Renamed')
                            .setDescription(`${client.emoji.success} Renamed role **${oldName}** to **${newName}** (<@&${roleToRename.id}>).`)
                            .setColor(roleToRename.color || client.color.main)
                            .setTimestamp()
                    ]
                });
            } catch (err: any) {
                return ctx.reply({ content: `${client.emoji.cross} Failed to rename role: ${err.message}` });
            }
        }

        // Handle Inrole / Members
        if (sub === 'inrole' || sub === 'members') {
            let roleToCheck: Role | null = null;
            if (ctx.interaction) {
                roleToCheck = ctx.options.getRole('role') as Role;
            } else {
                const roleQuery = args.slice(1).join(' ');
                roleToCheck = resolveRole(roleQuery);
            }

            if (!roleToCheck) {
                return ctx.reply({ content: `${client.emoji.cross} Could not find that role. Usage: \`${ctx.prefix}role inrole <role>\`` });
            }

            await ctx.guild.members.fetch().catch(() => {});
            const members = roleToCheck.members.sort((a, b) => a.displayName.localeCompare(b.displayName));
            const count = members.size;

            if (count === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`Members with ${roleToCheck.name} [0]`)
                    .setDescription('No members have this role.')
                    .setColor(roleToCheck.color || client.color.main)
                    .setTimestamp();
                return ctx.reply({ embeds: [embed] });
            }

            const membersArray = [...members.values()];
            const perPage = 30;
            const totalPages = Math.ceil(membersArray.length / perPage);
            let currentPage = 0;

            const buildEmbed = (page: number) => {
                const start = page * perPage;
                const end = Math.min(start + perPage, membersArray.length);
                const pageMembers = membersArray.slice(start, end);
                const lines = pageMembers.map((m: any) => `<@${m.user.id}> (${m.user.username})`);

                return new EmbedBuilder()
                    .setTitle(`Members with ${roleToCheck.name} [${count}]`)
                    .setDescription(lines.join('\n'))
                    .setColor(roleToCheck.color || client.color.main)
                    .setFooter({ text: `Page ${page + 1} of ${totalPages} • Total: ${count} members` })
                    .setTimestamp();
            };

            const buildButtons = (page: number) => {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId("inrole_first").setEmoji("⏮").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId("inrole_prev").setEmoji("◀").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId("inrole_page").setLabel(`${page + 1}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId("inrole_next").setEmoji("▶").setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
                    new ButtonBuilder().setCustomId("inrole_last").setEmoji("⏭").setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
                );
                return [row];
            };

            const embed = buildEmbed(currentPage);
            const components = totalPages > 1 ? buildButtons(currentPage) : [];

            await ctx.reply({ embeds: [embed], components });

            if (totalPages > 1 && ctx.channel && 'createMessageComponentCollector' in ctx.channel) {
                const collector = ctx.channel.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 120000,
                    filter: (i: any) => i.user.id === ctx.author.id && i.customId.startsWith('inrole_')
                });

                collector.on('collect', async (i: any) => {
                    await i.deferUpdate().catch(() => {});
                    if (i.customId === "inrole_first") currentPage = 0;
                    else if (i.customId === "inrole_prev") currentPage = Math.max(0, currentPage - 1);
                    else if (i.customId === "inrole_next") currentPage = Math.min(totalPages - 1, currentPage + 1);
                    else if (i.customId === "inrole_last") currentPage = totalPages - 1;

                    await ctx.editMessage({
                        embeds: [buildEmbed(currentPage)],
                        components: buildButtons(currentPage),
                    }).catch(() => {});
                });
            }

            return;
        }

        // Handle Strip (Admin only)
        if (sub === 'strip') {
            const isAdmin = ctx.member?.permissions.has(PermissionFlagsBits.Administrator) || ctx.author.id === ctx.guild.ownerId || isOwner || developer;
            if (!isAdmin) {
                return ctx.reply({ content: `${client.emoji.cross} Only administrators can use the \`role strip\` command.` });
            }

            if (ctx.interaction) {
                target = ctx.options.getMember('user') as GuildMember;
            } else {
                target = await Resolver.resolveMember(ctx, args[1]);
            }

            if (!target) {
                return ctx.reply({ content: `${client.emoji.cross} Could not find that member in this server. Usage: \`${ctx.prefix}role strip <user>\`` });
            }

            if (target.id === ctx.guild.ownerId) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot strip roles from the server owner.` });
            }

            if (target.id === ctx.author.id && !isOwner) {
                return ctx.reply({ content: `${client.emoji.cross} You cannot strip roles from yourself.` });
            }

            const isCallerGuildOwner = ctx.author.id === ctx.guild.ownerId;
            if (!isCallerGuildOwner && !isOwner && target.roles.highest.position >= ctx.member!.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} Hierarchy Violation: You cannot strip roles from someone with an equal or higher role than you.` });
            }

            const DANGEROUS_PERMS = [
                { flag: PermissionFlagsBits.Administrator, label: 'Administrator' },
                { flag: PermissionFlagsBits.ManageGuild, label: 'Manage Server' },
                { flag: PermissionFlagsBits.ManageRoles, label: 'Manage Roles' },
                { flag: PermissionFlagsBits.ManageChannels, label: 'Manage Channels' },
                { flag: PermissionFlagsBits.KickMembers, label: 'Kick Members' },
                { flag: PermissionFlagsBits.BanMembers, label: 'Ban Members' },
                { flag: PermissionFlagsBits.ModerateMembers, label: 'Timeout/Mute' },
                { flag: PermissionFlagsBits.ManageMessages, label: 'Manage Messages' },
                { flag: PermissionFlagsBits.ManageWebhooks, label: 'Manage Webhooks' },
                { flag: PermissionFlagsBits.ManageGuildExpressions, label: 'Manage Emojis/Stickers' },
                { flag: PermissionFlagsBits.MentionEveryone, label: 'Mention Everyone' },
                { flag: PermissionFlagsBits.ViewAuditLog, label: 'View Audit Log' },
                { flag: PermissionFlagsBits.ManageEvents, label: 'Manage Events' },
                { flag: PermissionFlagsBits.ManageThreads, label: 'Manage Threads' },
                { flag: PermissionFlagsBits.MuteMembers, label: 'Voice Mute' },
                { flag: PermissionFlagsBits.DeafenMembers, label: 'Voice Deafen' },
                { flag: PermissionFlagsBits.MoveMembers, label: 'Voice Move' },
            ];

            const botMember = ctx.guild.members.me as GuildMember;
            const botHighest = botMember.roles.highest.position;

            const dangerousRolesToRemove: { role: Role; perms: string[] }[] = [];
            const unmanageableDangerousRoles: { role: Role; perms: string[] }[] = [];
            const safeRolesKept: Role[] = [];

            for (const [, memberRole] of target.roles.cache) {
                if (memberRole.id === ctx.guild.id) continue; // skip @everyone

                const permsFound = DANGEROUS_PERMS
                    .filter(p => memberRole.permissions.has(p.flag))
                    .map(p => p.label);

                if (permsFound.length > 0) {
                    if (memberRole.managed || memberRole.position >= botHighest) {
                        unmanageableDangerousRoles.push({ role: memberRole, perms: permsFound });
                    } else {
                        dangerousRolesToRemove.push({ role: memberRole, perms: permsFound });
                    }
                } else {
                    safeRolesKept.push(memberRole);
                }
            }

            if (dangerousRolesToRemove.length === 0 && unmanageableDangerousRoles.length === 0) {
                return ctx.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🛡️ Role Strip Check')
                            .setDescription(`**${target.user.tag}** has no dangerous or staff permissions.\n\nAll **${safeRolesKept.length}** normal role(s) remain untouched.`)
                            .setColor(client.color.main)
                            .setFooter({ text: `Requested by ${ctx.author.tag}` })
                            .setTimestamp()
                    ]
                });
            }

            if (dangerousRolesToRemove.length > 0) {
                await target.roles.remove(
                    dangerousRolesToRemove.map(r => r.role),
                    `Dangerous roles stripped by admin ${ctx.author.tag}`
                );
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Dangerous Roles Stripped')
                .setDescription(`Processed role strip for **${target.user.tag}** (${target.id})`)
                .setColor(dangerousRolesToRemove.length > 0 ? client.color.main : client.color.red)
                .setFooter({ text: `Stripped by ${ctx.author.tag}` })
                .setTimestamp();

            if (dangerousRolesToRemove.length > 0) {
                const removedText = dangerousRolesToRemove
                    .map(r => `• <@&${r.role.id}> (\`${r.perms.slice(0, 3).join(', ')}${r.perms.length > 3 ? ` +${r.perms.length - 3} more` : ''}\`)`)
                    .join('\n');
                embed.addFields({
                    name: `❌ Stripped Roles (${dangerousRolesToRemove.length})`,
                    value: removedText.length > 1024 ? removedText.slice(0, 1020) + '...' : removedText
                });
            }

            if (unmanageableDangerousRoles.length > 0) {
                const unmanagedText = unmanageableDangerousRoles
                    .map(r => `• <@&${r.role.id}> (${r.role.managed ? 'Managed Role' : 'Above Bot Role'})`)
                    .join('\n');
                embed.addFields({
                    name: `⚠️ Could Not Remove (${unmanageableDangerousRoles.length})`,
                    value: unmanagedText.length > 1024 ? unmanagedText.slice(0, 1020) + '...' : unmanagedText
                });
            }

            const keptText = safeRolesKept.length > 0
                ? safeRolesKept.map(r => `<@&${r.id}>`).join(', ')
                : 'None';
            embed.addFields({
                name: `✅ Kept Normal Roles (${safeRolesKept.length})`,
                value: keptText.length > 1024 ? keptText.slice(0, 1020) + '...' : keptText
            });

            return ctx.reply({ embeds: [embed] });
        }

        // Handle Move/Position
        if (sub === 'move' || sub === 'pos' || sub === 'position') {
            let targetPosition: number | null = null;

            if (ctx.interaction) {
                role = ctx.options.getRole('role') as Role;
                targetPosition = ctx.options.getInteger('position');
            } else {
                if (args.length < 3) {
                    return ctx.reply({ content: `${client.emoji.cross} Usage: \`${ctx.prefix}role move <@role/role_id/name> <position_number>\` (e.g. \`${ctx.prefix}role move @VIP 3\`)\nUse \`${ctx.prefix}roles\` to view numbered positions.` });
                }

                // Check if last arg is a number or if second arg is a number
                const lastArg = args[args.length - 1];
                const parsedLast = parseInt(lastArg, 10);

                if (!isNaN(parsedLast)) {
                    targetPosition = parsedLast;
                    const roleQuery = args.slice(1, args.length - 1).join(' ');
                    role = resolveRole(roleQuery);
                } else {
                    const parsedSecond = parseInt(args[1], 10);
                    if (!isNaN(parsedSecond)) {
                        targetPosition = parsedSecond;
                        const roleQuery = args.slice(2).join(' ');
                        role = resolveRole(roleQuery);
                    }
                }
            }

            if (!role) {
                return ctx.reply({ content: `${client.emoji.cross} Could not find that role.` });
            }

            if (targetPosition === null || isNaN(targetPosition) || targetPosition < 1) {
                return ctx.reply({ content: `${client.emoji.cross} Please provide a valid position number (1 or higher).` });
            }

            // Hierarchy & Permission checks
            const clientMember = ctx.guild.members.me || (client.user ? ctx.guild.members.resolve(client.user.id) : null);
            if (!clientMember) return ctx.reply({ content: `${client.emoji.cross} Bot member not found.` });

            // Check if bot can manage the role
            if (role.position >= clientMember.roles.highest.position) {
                return ctx.reply({ content: `${client.emoji.cross} I cannot move <@&${role.id}> because it is higher than or equal to my highest role (<@&${clientMember.roles.highest.id}>).` });
            }

            // Check if user can manage the role (unless owner or dev)
            if (!isOwner && ctx.author.id !== ctx.guild.ownerId && ctx.member) {
                if (role.position >= ctx.member.roles.highest.position) {
                    return ctx.reply({ content: `${client.emoji.cross} You cannot move <@&${role.id}> because it is higher than or equal to your highest role.` });
                }
            }

            if (role.managed) {
                return ctx.reply({ content: `${client.emoji.cross} <@&${role.id}> is managed by an integration/bot and cannot be manually moved.` });
            }

            // Fetch guild roles sorted by hierarchy descending (as displayed in ,roles)
            const sortedRoles = [...ctx.guild.roles.cache
                .filter((r: Role) => r.id !== ctx.guild.id)
                .sort((a: Role, b: Role) => b.position - a.position)
                .values()];

            const totalRoles = sortedRoles.length;
            if (targetPosition > totalRoles) {
                return ctx.reply({ content: `${client.emoji.cross} Position \`${targetPosition}\` is out of bounds. This server has \`${totalRoles}\` custom roles (1 - ${totalRoles}).` });
            }

            const oldIndex = sortedRoles.findIndex(r => r.id === role!.id);
            if (oldIndex === -1) {
                return ctx.reply({ content: `${client.emoji.cross} Role not found in server hierarchy.` });
            }

            const oldRank = oldIndex + 1;
            const targetRank = targetPosition; // 1-indexed

            if (oldRank === targetRank) {
                return ctx.reply({ content: `ℹ️ <@&${role.id}> is already at position **#${targetRank}**.` });
            }

            const targetIndex = targetRank - 1;
            const roleAtTarget = sortedRoles[targetIndex];

            // Check if moving to this position would put the role above bot's highest role
            if (roleAtTarget && roleAtTarget.position >= clientMember.roles.highest.position && targetRank <= oldRank) {
                return ctx.reply({ content: `${client.emoji.cross} Cannot move <@&${role.id}> to position **#${targetRank}** because it is higher than or equal to my highest role.` });
            }

            // User hierarchy check for target rank
            if (!isOwner && ctx.author.id !== ctx.guild.ownerId && ctx.member) {
                if (roleAtTarget && roleAtTarget.position >= ctx.member.roles.highest.position && targetRank <= oldRank) {
                    return ctx.reply({ content: `${client.emoji.cross} Cannot move <@&${role.id}> to position **#${targetRank}** because it is higher than or equal to your highest role.` });
                }
            }

            // Reorder array: remove role from oldIndex, insert at targetIndex
            const newRolesOrder = [...sortedRoles];
            const [removed] = newRolesOrder.splice(oldIndex, 1);
            newRolesOrder.splice(targetIndex, 0, removed);

            // Construct new position payload for Discord API
            const positionPayload = newRolesOrder.map((r, idx) => ({
                role: r.id,
                position: newRolesOrder.length - idx
            }));

            await ctx.guild.roles.setPositions(positionPayload);

            return ctx.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Role Position Updated')
                        .setDescription(`Successfully moved <@&${role.id}> from position **#${oldRank}** to **#${targetRank}**.\n\nUse \`${ctx.prefix}roles\` to view the updated hierarchy.`)
                        .setColor(client.color.main)
                        .setFooter({ text: `Moved by ${ctx.author.tag}` })
                        .setTimestamp()
                ]
            });
        }

        return ctx.reply({ content: `${client.emoji.cross} Unknown subcommand \`${sub}\`. Usage: \`${ctx.prefix}role <add/remove/create/delete/color/icon/info/inrole/exch/rename/strip/move>\`` });
    } catch (err: any) {
        console.error('[RoleCommand Error]:', err);
        return ctx.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Error Executing Command')
                    .setDescription(`${client.emoji.cross} An error occurred: \`${err.message || err}\``)
                    .setColor(client.color.red)
            ]
        }).catch(() => {});
    }
	}
}
