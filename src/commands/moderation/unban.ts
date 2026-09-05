import { 
    PermissionFlagsBits, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Unban extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'unban',
			description: {
				content: 'Unban a user from the server.',
				usage: 'unban <user_id> [reason]',
				examples: ['unban 123456789012345678 Misunderstanding']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.BanMembers],
				client: [PermissionFlagsBits.BanMembers]
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
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid User`,
				description: 'Please provide a valid user ID or mention to unban.', 
				borderless: true,
				color: null,
				isAlert: true 
			});
		}

		try {
			const ban = await ctx.guild.bans.fetch(user.id).catch(() => null);
			if (!ban) {
				return await ctx.replyV2({ 
					title: `${client.emoji.cross} Not Banned`,
					description: `**${user.tag}** (\`${user.id}\`) is not currently banned from this server.`, 
					borderless: true,
					color: null,
					isAlert: true 
				});
			}

			const force = args.includes('--force') || args.includes('-f');
			const confirmed = await ModConfirmation.ask({
				client,
				ctx,
				actionName: 'Unban User',
				targetName: `${user.tag} (${user.id})`,
				targetAvatar: user.displayAvatarURL(),
				dangerLevel: 'primary',
				reason,
				confirmLabel: 'Confirm Unban',
				confirmEmoji: client.emoji?.volmore || '🔓',
				force
			});

			if (!confirmed) return;

			await ctx.guild.bans.remove(user.id, `Unbanned by ${ctx.author.tag}: ${reason}`);
			
            // Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'UNBAN',
                target: user,
                moderator: ctx.author,
                reason
            });

			return await ctx.replyV2({
				title: `${client.emoji.volmore} Member Unbanned`,
				description: 
					`**${user.tag}** (\`${user.id}\`) has been unbanned.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${user.id}> (\`${user.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					`• **Reason:** ${reason}`,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [user.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`,
				description: `Failed to unban user: ${error.message}`, 
				borderless: true,
				color: null,
				isAlert: true 
			});
		}
	}
}
