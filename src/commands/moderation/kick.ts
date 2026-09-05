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

export default class Kick extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'kick',
			description: {
				content: 'Kick a member from the server.',
				usage: 'kick <user> [reason]',
				examples: ['kick @User Disrespectful']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.KickMembers],
				client: [PermissionFlagsBits.KickMembers]
			},
			options: [
				{
					name: 'user',
					description: 'The user to kick',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the kick',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx);
		const reason = ctx.options.getString('reason') || args.slice(1).join(' ') || 'No reason provided';

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
				description: 'You cannot kick yourself from the server.', 
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
				description: 'You cannot kick someone with a higher or equal role to you.', 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}

		if (!target.kickable) {
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
			actionName: 'Kick Member',
			targetName: `${target.user.tag} (${target.id})`,
			targetAvatar: target.user.displayAvatarURL(),
			dangerLevel: 'danger',
			reason,
			confirmLabel: 'Confirm Kick',
			confirmEmoji: client.emoji?.mod_kick || '👢',
			force
		});

		if (!confirmed) return;

		try {
            // Send DM before kicking
            await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'KICK', reason);
            
			await target.kick(`Kicked by ${ctx.author.tag}: ${reason}`);
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'KICK',
                target: target.user,
                moderator: ctx.author,
                reason
            });

			return await ctx.replyV2({
				title: `${client.emoji.mod_kick} Member Kicked`,
				description: 
					`**${target.user.tag}** has been kicked from the server.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${target.id}> (\`${target.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					`• **Reason:** ${reason}`,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`, 
				description: `Failed to execute kick: ${error.message}`, 
				borderless: true, 
				color: null, 
				isAlert: true 
			});
		}
	}
}
