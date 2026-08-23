import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { logModerationAction } from '../../utils/Logger';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';

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
        await ctx.deferReply();
        
        const user = await Resolver.resolveUser(ctx, ctx.options.getString('id') || args[0]);
		const reason = ctx.options.getString('reason') || args.slice(1).join(' ') || 'No reason provided';

		if (!user) {
			return await ctx.reply({ content: `${client.emoji.cross} Please provide a valid user ID or mention.`, flags: [64] });
		}

		try {
			const ban = await ctx.guild.bans.fetch(user.id).catch(() => null);
			if (!ban) {
				return await ctx.reply({ content: `${client.emoji.cross} This user is not banned from this server.`, flags: [64] });
			}

			await ctx.guild.bans.remove(user.id, `Unbanned by ${ctx.author.tag}: ${reason}`);
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'UNBAN',
                target: user,
                moderator: ctx.author,
                reason
            });

			const embed = new EmbedBuilder()
				.setTitle(`${client.emoji.volmore} Member Unbanned`)
				.setDescription(`**${user.tag}** (\`${user.id}\`) has been unbanned.`)
				.addFields(
                    { name: 'Case', value: `\`#${newCase.caseNumber}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
				.setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber}` })
				.setTimestamp();

			await ctx.reply({ embeds: [embed] });
		} catch (error: any) {
			await ctx.reply({ content: `${client.emoji.cross} Failed to unban: ${error.message}`, flags: [64] });
		}
	}
}
