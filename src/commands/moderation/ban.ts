import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';
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
				usage: 'ban <user> [reason]',
				examples: ['ban @User Breaking rules']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.BanMembers],
				client: [PermissionFlagsBits.BanMembers, PermissionFlagsBits.EmbedLinks]
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
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        const target = await Resolver.resolveMember(ctx);
		const reason = ctx.options.getString('reason') || args.slice(1).join(' ') || 'No reason provided';

		if (!target) {
			return await ctx.replyV2({ description: 'Could not find that member in this server.', color: client.color.red, isAlert: true });
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ description: 'You cannot ban yourself.', color: client.color.red, isAlert: true });
		}

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ description: 'Hierarchy Violation: You cannot ban someone with a higher or equal role.', color: client.color.red, isAlert: true });
		}

		if (!target.bannable) {
			return await ctx.replyV2({ description: 'Hierarchy Block: My role position is below this user. Move me higher to enable moderation.', color: client.color.red, isAlert: true });
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
            
			await target.ban({ reason: `Banned by ${ctx.author.tag}: ${reason}` });
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'BAN',
                target: target.user,
                moderator: ctx.author,
                reason
            });

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.hammer} Member Banned`)
				.setDescription(`**${target.user.tag}** has been banned from the server.`)
				.addFields(
                    { name: 'Case', value: `\`#${newCase.caseNumber}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
				.setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber}` })
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (error: any) {
			await ctx.replyV2({ title: 'Execution Error', description: `Failed to execute ban: ${error.message}`, color: client.color.red, isAlert: true });
		}
	}
}
