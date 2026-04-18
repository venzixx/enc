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
			return await ctx.reply({ content: `${client.emoji.cross} Could not find that member.`, flags: [64] });
		}

		if (target.id === ctx.author.id) {
			return await ctx.reply({ content: `${client.emoji.cross} You cannot ban yourself.`, flags: [64] });
		}

		if (ctx.author.id !== ctx.guild.ownerId && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.reply({ content: `${client.emoji.cross} You cannot ban someone with a higher or equal role.`, flags: [64] });
		}

		if (!target.bannable) {
			return await ctx.reply({ content: `${client.emoji.cross} I cannot ban this user. Check my role position.`, flags: [64] });
		}

		try {
			await target.ban({ reason: `Banned by ${ctx.author.tag}: ${reason}` });
			
			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.hammer} Member Banned`)
				.setDescription(`**${target.user.tag}** has been banned from the server.`)
				.addFields({ name: `${client.emoji.mic} Reason`, value: reason })
				.setColor(client.color.main)
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });

            await logModerationAction(client, ctx.guild, 'BAN', ctx.author, target.user, reason);
		} catch (error: any) {
			await ctx.reply({ content: `${client.emoji.cross} Failed to ban: ${error.message}`, flags: [64] });
		}
	}
}
