import { 
    PermissionFlagsBits, 
    GuildMember, 
    User,
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { Appeals } from '../../utils/Appeals';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Ban extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'ban',
			aliases: ['hackban', 'idban', 'softban'],
			description: {
				content: 'Ban a member or user ID from the server, with optional softban support.',
				usage: 'ban <user|id> [reason] [days] [--soft]',
				examples: [
					'ban @User Breaking rules', 
					'ban 1234567890 Raid bot 7',
					'ban @User Spam --soft',
					'softban @User Purge messages and kick'
				]
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.BanMembers],
				client: [PermissionFlagsBits.BanMembers]
			},
			options: [
				{
					name: 'user',
					description: 'The user or user ID to ban',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the ban',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'days',
					description: 'Days of message history to delete (0-7)',
					type: ApplicationCommandOptionType.Integer,
					required: false,
					min_value: 0,
					max_value: 7
				},
				{
					name: 'softban',
					description: 'Softban: bans and immediately unbans to purge messages and kick',
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const invokedCommand = ctx.isInteraction ? 'ban' : ((ctx as any).commandName || '');
        const isInvokedAsSoftban = invokedCommand === 'softban';

        // 1. Check Softban Flag
        const slashSoftban = ctx.isInteraction ? ctx.options.getBoolean('softban') : false;
        const prefixSoftban = args.some(a => a.toLowerCase() === '--soft' || a.toLowerCase() === '-s') || isInvokedAsSoftban;
        const isSoftban = slashSoftban || prefixSoftban;

        // 2. Parse User & Member
        let targetMember: GuildMember | null = await Resolver.resolveMember(ctx, args[0]);
        let targetUser: User | null = targetMember ? targetMember.user : await Resolver.resolveUser(ctx, args[0]);

        if (!targetUser && args[0]) {
            const cleanId = args[0].replace(/[<@!>]/g, '');
            if (/^\d{17,19}$/.test(cleanId)) {
                targetUser = await client.users.fetch(cleanId).catch(() => null);
            }
        }

		if (!targetUser) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} User Not Found`,
				description: 'Could not find that member in this server or by User ID.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

        // 3. Parse Reason & Days
        const cleanArgs = args.filter(a => a.toLowerCase() !== '--soft' && a.toLowerCase() !== '-s' && a.toLowerCase() !== '--force' && a.toLowerCase() !== '-f');
		const reason = ctx.options.getString('reason') || cleanArgs.slice(1).filter(a => !/^[0-7]$/.test(a)).join(' ') || 'No reason provided';
		let days = ctx.options.getInteger('days');
        if (days === null || days === undefined) {
            const lastArg = cleanArgs[cleanArgs.length - 1];
            if (lastArg && /^[0-7]$/.test(lastArg)) {
                days = parseInt(lastArg);
            } else {
                days = isSoftban ? 1 : 0; // Default 1 day purge for softban, 0 for normal ban
            }
        }

        // 4. Safety & Hierarchy Checks
		if (targetUser.id === ctx.author.id) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: `You cannot ${isSoftban ? 'softban' : 'ban'} yourself.`, 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

        if (targetUser.id === ctx.guild.ownerId) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: `You cannot ${isSoftban ? 'softban' : 'ban'} the server owner.`, 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
        }

        // Check if member is in server: check role hierarchy
        if (targetMember) {
            const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
            const isBotOwner = BOT_OWNERS.has(ctx.author.id);
            if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && targetMember.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Hierarchy Violation`,
                    description: `You cannot ${isSoftban ? 'softban' : 'ban'} someone with a higher or equal role than you.`, 
                    borderless: true, 
                    color: null, 
                    isAlert: true,
                    allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
                });
            }

            if (!targetMember.bannable) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Bot Hierarchy Error`,
                    description: 'My role position is below this user. Move my role higher to enable moderation.', 
                    borderless: true, 
                    color: null, 
                    isAlert: true,
                    allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
                });
            }
        } else {
            // Target is not in the guild (ID Ban): Check if already banned
            const existingBan = await ctx.guild.bans.fetch(targetUser.id).catch(() => null);
            if (existingBan && !isSoftban) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Already Banned`,
                    description: `**${targetUser.tag}** (\`${targetUser.id}\`) is already banned from this server.`, 
                    borderless: true, 
                    color: null, 
                    isAlert: true,
                    allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
                });
            }
        }

        // 5. Interactive Confirmation
		const force = args.includes('--force') || args.includes('-f');
        const isIDBan = !targetMember;
        const actionTitle = isSoftban ? 'Softban Member' : (isIDBan ? 'ID Ban (Hackban)' : 'Ban Member');
        const confirmDetails = isSoftban
            ? `Ban and immediately unban to delete messages (${days} day(s)) and kick from server.`
            : (isIDBan ? `Target is not in the server. Ban account by User ID (${targetUser.id}).` : `Ban member from the server. (Message purge: ${days} day(s))`);

		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: actionTitle,
			targetName: `${targetUser.tag} (${targetUser.id})`,
			targetAvatar: targetUser.displayAvatarURL(),
			dangerLevel: isSoftban ? 'warning' : 'danger',
			details: confirmDetails,
			reason,
			confirmLabel: isSoftban ? 'Confirm Softban' : (isIDBan ? 'Confirm ID Ban' : 'Confirm Ban'),
			confirmEmoji: isSoftban ? '🧹' : (client.emoji?.hammer || '🔨'),
			force
		});

		if (!confirmed) return;

        // 6. Execute Action
		try {
            // Attempt to send appeal DM if not softbanning
            if (!isSoftban) {
                await Appeals.sendAppealDM(client, targetUser, ctx.guild!, 'BAN', reason).catch(() => {});
            }

            if (targetMember) {
                await targetMember.ban({ 
                    reason: `${isSoftban ? 'Softbanned' : 'Banned'} by ${ctx.author.tag}: ${reason}`,
                    deleteMessageSeconds: days * 86400
                });
            } else {
                await ctx.guild.bans.create(targetUser.id, {
                    reason: `ID Banned by ${ctx.author.tag}: ${reason}`,
                    deleteMessageSeconds: days * 86400
                });
            }

            // If Softban, unban immediately
            if (isSoftban) {
                await ctx.guild.bans.remove(targetUser.id, `Softban auto-unban by ${ctx.author.tag}`).catch(() => {});
            }
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: isSoftban ? 'SOFTBAN' : 'BAN',
                target: targetUser,
                moderator: ctx.author,
                reason
            });

            const emoji = isSoftban ? '🧹' : (client.emoji.hammer || '🔨');
            const resultTitle = isSoftban ? 'Member Softbanned' : (isIDBan ? 'User ID Banned (Hackban)' : 'Member Banned');

			return await ctx.replyV2({
				title: `${emoji} ${resultTitle}`,
				description: 
					`**${targetUser.tag}** has been ${isSoftban ? 'softbanned' : 'banned'}.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					(days > 0 ? `• **Messages Purged:** Last ${days} day(s)\n` : '') +
					(isSoftban ? `• **Mode:** Softban (Kicked & unbanned)\n` : (isIDBan ? `• **Mode:** Hackban (User was not in server)\n` : '')) +
					`• **Reason:** ${reason}`,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [targetUser.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`, 
				description: `Failed to execute ${isSoftban ? 'softban' : 'ban'}: ${error.message}`, 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}
	}
}
