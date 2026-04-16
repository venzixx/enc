import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';

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
		const target = ctx.options.getMember('user') as GuildMember;
		const reason = ctx.options.getString('reason') || args.slice(1).join(' ') || 'No reason provided';

		if (!target) {
			return await ctx.reply({ content: 'âŒ Could not find that member.', flags: [64] });
		}

		if (target.id === ctx.author.id) {
			return await ctx.reply({ content: 'âŒ You cannot kick yourself.', flags: [64] });
		}

		if (target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: 'âŒ You cannot kick someone with a higher or equal role.', flags: [64] });
		}

		if (!target.kickable) {
			return await ctx.reply({ content: 'âŒ I cannot kick this user. Check my role position.', flags: [64] });
		}

		try {
			await target.kick(`Kicked by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle('ðŸ‘¢ Member Kicked')
				.setDescription(`**${target.user.tag}** has been kicked from the server.`)
				.addFields({ name: 'ðŸ’¬ Reason', value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'KICK', ctx.author, target.user, reason);
		} catch (error: any) {
			await ctx.reply({ content: `âŒ Failed to kick: ${error.message}`, flags: [64] });
		}
	}
}
