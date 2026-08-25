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
				client: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.EmbedLinks]
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
			return await ctx.replyV2({ description: 'Could not find that member in this server.', color: client.color.red, isAlert: true });
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ description: 'You cannot kick yourself.', color: client.color.red, isAlert: true });
		}

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ description: 'Hierarchy Violation: You cannot kick someone with a higher or equal role.', color: client.color.red, isAlert: true });
		}

		if (!target.kickable) {
			return await ctx.replyV2({ description: 'Hierarchy Block: My role position is below this user. Move me higher to enable moderation.', color: client.color.red, isAlert: true });
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

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.mod_kick} Member Kicked`)
				.setDescription(`**${target.user.tag}** has been kicked from the server.`)
				.addFields(
                    { name: 'Case', value: `\`#${newCase.caseNumber}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
				.setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber}` })
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (error: any) {
			await ctx.replyV2({ title: 'Execution Error', description: `Failed to execute kick: ${error.message}`, color: client.color.red, isAlert: true });
		}
	}
}
