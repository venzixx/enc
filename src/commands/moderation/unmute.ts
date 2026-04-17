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
			return await ctx.reply({ content: '❌ Could not find that member.', flags: [64] });
		}

		if (ctx.author.id !== ctx.guild.ownerId && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: '❌ You cannot unmute someone with a higher or equal role.', flags: [64] });
		}

		if (!target.communicationDisabledUntilTimestamp) {
			return await ctx.reply({ content: '❌ This user is not timed out.', flags: [64] });
		}

		try {
			await target.timeout(null, `Unmuted by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle('🔊 Member Unmuted')
				.setDescription(`**${target.user.tag}**'s timeout has been removed.`)
				.addFields({ name: '💬 Reason', value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'UNMUTE', ctx.author, target.user, reason);
		} catch (error: any) {
			await ctx.reply({ content: `❌ Failed to unmute: ${error.message}`, flags: [64] });
		}
	}
}
