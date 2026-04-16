import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';

export default class Unban extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'unban',
			description: {
				content: 'Unban a member from the server.',
				usage: 'unban <user_id> [reason]',
				examples: ['unban 123456789012345678 Misunderstanding']
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
					name: 'id',
					description: 'The ID of the user to unban',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'reason',
					description: 'Reason for the unban',
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
		const userId = ctx.options.getString('id') || args[0];
		const reason = ctx.options.getString('reason') || args.slice(1).join(' ') || 'No reason provided';

		if (!userId) {
			return await ctx.reply({ content: 'âŒ Please provide a user ID.', flags: [64] });
		}

		try {
			const ban = await ctx.guild.bans.fetch(userId).catch(() => null);
			if (!ban) {
				return await ctx.reply({ content: 'âŒ This user is not banned from this server.', flags: [64] });
			}

			await ctx.guild.bans.remove(userId, `Unbanned by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle('ðŸ”“ Member Unbanned')
				.setDescription(`**${ban.user.tag}** (\`${userId}\`) has been unbanned.`)
				.addFields({ name: 'ðŸ’¬ Reason', value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'UNBAN', ctx.author, ban.user, reason);
		} catch (error: any) {
			await ctx.reply({ content: `âŒ Failed to unban: ${error.message}`, flags: [64] });
		}
	}
}
