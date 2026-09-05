import { 
    PermissionFlagsBits, 
    GuildMember, 
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
			description: {
				content: 'Ban a member from the server.',
				usage: 'ban <user> [reason] [days]',
				examples: ['ban @User Breaking rules', 'ban @User Spam 1']
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
					description: 'The user to ban',
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
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx);
		const reason = ctx.options.getString('reason') || args.slice(1).filter(a => !/^[0-7]$/.test(a)).join(' ') || 'No reason provided';
		const days = ctx.options.getInteger('days') || (args[args.length - 1] && /^[0-7]$/.test(args[args.length - 1]) ? parseInt(args[args.length - 1]) : 0);

		if (!target) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Member Not Found`,
				description: 'Could not find that member in this server.', 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: 'You cannot ban yourself from the server.', 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Hierarchy Violation`,
				description: 'You cannot ban someone with a higher or equal role to you.', 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}

		if (!target.bannable) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Bot Hierarchy Error`,
				description: 'My role position is below this user. Move my role higher to enable moderation.', 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}

		const force = args.includes('--force') || args.includes('-f');
		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: 'Ban Member',
			targetName: `${target.user.tag} (${target.id})`,
			targetAvatar: target.user.displayAvatarURL(),
			dangerLevel: 'danger',
			reason,
			confirmLabel: 'Confirm Ban',
			confirmEmoji: client.emoji?.hammer || '🔨',
			force
		});

		if (!confirmed) return;

		try {
            // Send DM before banning so we have access to the member
            await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'BAN', reason);
            
			await target.ban({ 
				reason: `Banned by ${ctx.author.tag}: ${reason}`,
				deleteMessageSeconds: days * 86400
			});
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'BAN',
                target: target.user,
                moderator: ctx.author,
                reason
            });

			return await ctx.replyV2({
				title: `${client.emoji.hammer} Member Banned`,
				description: 
					`**${target.user.tag}** has been banned from the server.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${target.id}> (\`${target.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					(days > 0 ? `• **Messages Deleted:** Last ${days} day(s)\n` : '') +
					`• **Reason:** ${reason}`,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`, 
				description: `Failed to execute ban: ${error.message}`, 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}
	}
}
