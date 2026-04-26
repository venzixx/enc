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
			return await ctx.reply({ content: `${client.emoji.cross} Could not find that member.`, flags: [64] });
		}

		if (target.id === ctx.author.id) {
			return await ctx.reply({ content: `${client.emoji.cross} You cannot kick yourself.`, flags: [64] });
		}

		if (ctx.author.id !== ctx.guild.ownerId && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: `${client.emoji.cross} You cannot kick someone with a higher or equal role.`, flags: [64] });
		}

		if (!target.kickable) {
			return await ctx.reply({ content: `${client.emoji.cross} I cannot kick this user. Check my role position.`, flags: [64] });
		}

		try {
            // Send DM before kicking
            await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'KICK', reason);
            
			await target.kick(`Kicked by ${ctx.author.tag}: ${reason}`);
			
			const embed = new EmbedBuilder()
				.setTitle(' Member Kicked')
				.setDescription(`**${target.user.tag}** has been kicked from the server.`)
				.addFields({ name: `${client.emoji.mic} Reason`, value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'KICK', ctx.author, target.user, reason);
		} catch (error: any) {
			await ctx.reply({ content: `${client.emoji.cross} Failed to kick: ${error.message}`, flags: [64] });
		}
	}
}
