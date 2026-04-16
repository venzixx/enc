import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';
import ms from 'ms';

export default class Mute extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'mute',
			description: {
				content: 'Timeout a member in the server.',
				usage: 'mute <user> <duration> [reason]',
				examples: ['mute @User 10m Spamming']
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
					description: 'The user to mute',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'duration',
					description: 'Duration (e.g. 10m, 1h, 1d)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the mute',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const target = ctx.options.getMember('user') as GuildMember;
		const durationStr = ctx.options.getString('duration') || args[1];
		const reason = ctx.options.getString('reason') || args.slice(2).join(' ') || 'No reason provided';

		if (!target) {
			return await ctx.reply({ content: 'âŒ Could not find that member.', flags: [64] });
		}

		if (target.id === ctx.author.id) {
			return await ctx.reply({ content: 'âŒ You cannot mute yourself.', flags: [64] });
		}

		if (target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: 'âŒ You cannot mute someone with a higher or equal role.', flags: [64] });
		}

		if (!target.manageable) {
			return await ctx.reply({ content: 'âŒ I cannot mute this user. Check my role position.', flags: [64] });
		}

		const time = durationStr ? ms(durationStr) : null;
		if (!time || (time as any) < 10000 || (time as any) > 2419200000) {
			return await ctx.reply({ content: 'âŒ Invalid duration. Must be between 10s and 28 days.', flags: [64] });
		}

		try {
			await target.timeout(time as any, `Muted by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle('ðŸ”‡ Member Muted')
				.setDescription(`**${target.user.tag}** has been timed out for **${durationStr}**.`)
				.addFields({ name: 'ðŸ’¬ Reason', value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'MUTE', ctx.author, target.user, reason, durationStr);
		} catch (error: any) {
			await ctx.reply({ content: `âŒ Failed to mute: ${error.message}`, flags: [64] });
		}
	}
}
