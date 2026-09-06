import { 
    PermissionFlagsBits, 
    GuildMember, 
    User,
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Softban extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'softban',
			aliases: ['sban'],
			description: {
				content: 'Softban a member: bans and immediately unbans to purge their messages and kick them.',
				usage: 'softban <user> [reason] [days]',
				examples: ['softban @User Spamming chat', 'softban @User Trolling 7']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers],
				client: [PermissionFlagsBits.BanMembers]
			},
			options: [
				{
					name: 'user',
					description: 'The member to softban',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the softban',
					type: ApplicationCommandOptionType.String,
					required: false
				},
				{
					name: 'days',
					description: 'Days of message history to delete (1-7, default: 1)',
					type: ApplicationCommandOptionType.Integer,
					required: false,
					min_value: 1,
					max_value: 7
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

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
				title: `${client.emoji.cross} Member Not Found`,
				description: 'Could not find that member in this server.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

        const cleanArgs = args.filter(a => a.toLowerCase() !== '--force' && a.toLowerCase() !== '-f');
		const reason = ctx.options.getString('reason') || cleanArgs.slice(1).filter(a => !/^[1-7]$/.test(a)).join(' ') || 'No reason provided';
		let days = ctx.options.getInteger('days');
        if (days === null || days === undefined) {
            const lastArg = cleanArgs[cleanArgs.length - 1];
            if (lastArg && /^[1-7]$/.test(lastArg)) {
                days = parseInt(lastArg);
            } else {
                days = 1; // Default 1 day for softban
            }
        }

		if (targetUser.id === ctx.author.id) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: 'You cannot softban yourself.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

        if (targetUser.id === ctx.guild.ownerId) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: 'You cannot softban the server owner.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
        }

        if (targetMember) {
            const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
            const isBotOwner = BOT_OWNERS.has(ctx.author.id);
            if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && targetMember.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Hierarchy Violation`,
                    description: 'You cannot softban someone with a higher or equal role than you.', 
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
        }

		const force = args.includes('--force') || args.includes('-f');
		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: 'Softban Member',
			targetName: `${targetUser.tag} (${targetUser.id})`,
			targetAvatar: targetUser.displayAvatarURL(),
			dangerLevel: 'warning',
			details: `Ban and immediately unban to delete messages (${days} day(s)) and kick from server.`,
			reason,
			confirmLabel: 'Confirm Softban',
			confirmEmoji: '🧹',
			force
		});

		if (!confirmed) return;

		try {
            if (targetMember) {
                await targetMember.ban({ 
                    reason: `Softbanned by ${ctx.author.tag}: ${reason}`,
                    deleteMessageSeconds: days * 86400
                });
            } else {
                await ctx.guild.bans.create(targetUser.id, {
                    reason: `Softbanned by ${ctx.author.tag}: ${reason}`,
                    deleteMessageSeconds: days * 86400
                });
            }

            // Immediately unban
            await ctx.guild.bans.remove(targetUser.id, `Softban auto-unban by ${ctx.author.tag}`).catch(() => {});

            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'SOFTBAN',
                target: targetUser,
                moderator: ctx.author,
                reason
            });

			return await ctx.replyV2({
				title: `🧹 Member Softbanned`,
				description: 
					`**${targetUser.tag}** has been softbanned.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					`• **Messages Purged:** Last ${days} day(s)\n` +
					`• **Status:** Kicked & unbanned\n` +
					`• **Reason:** ${reason}`,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [targetUser.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`, 
				description: `Failed to execute softban: ${error.message}`, 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}
	}
}
