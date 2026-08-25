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
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Unmute extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'unmute',
			description: {
				content: 'Remove timeout from a member.',
				usage: 'unmute <user> [reason]',
				examples: ['unmute @User Appeal successful']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.ModerateMembers],
				client: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.EmbedLinks]
			},
			options: [
				{
					name: 'user',
					description: 'The user to unmute',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the unmute',
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
			return await ctx.reply({ content: `${client.emoji.cross} Could not find that member.`, flags: [64] });
		}

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: `${client.emoji.cross} You cannot unmute someone with a higher or equal role.`, flags: [64] });
		}

		const hasTimeout = Boolean(target.communicationDisabledUntilTimestamp);

		const force = args.includes('--force') || args.includes('-f');
		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: 'Unmute Member',
			targetName: `${target.user.tag} (${target.id})`,
			targetAvatar: target.user.displayAvatarURL(),
			dangerLevel: 'primary',
			reason,
			confirmLabel: 'Confirm Unmute',
			confirmEmoji: client.emoji?.volmore || '🔊',
			force
		});

		if (!confirmed) return;

		try {
            // 1. Remove timeout if active
			if (hasTimeout) {
                await target.timeout(null, `Unmuted by ${ctx.author.tag}: ${reason}`);
            }
			
            // 2. Restore any admin roles that were temporarily removed during force mute
            const restoredRoles = await CaseManager.restoreMutedRoles(client, ctx.guild!, target.id);

            if (!hasTimeout && restoredRoles.length === 0) {
                return await ctx.reply({ content: `${client.emoji.cross} This user is not timed out and has no pending roles to restore.`, flags: [64] });
            }

            // 3. Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'UNMUTE',
                target: target.user,
                moderator: ctx.author,
                reason
            });

            const restoredText = restoredRoles.length > 0
                ? `\n**Restored Role(s):** ${restoredRoles.map(r => `\`${r}\``).join(', ')}`
                : '';

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.volmore} Member Unmuted`)
				.setDescription(`**${target.user.tag}** has been unmuted.${restoredText}`)
				.addFields(
                    { name: 'Case', value: `\`#${newCase.caseNumber}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
				.setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber}` })
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (error: any) {
			await ctx.reply({ content: `${client.emoji.cross} Failed to unmute: ${error.message}`, flags: [64] });
		}
	}
}
