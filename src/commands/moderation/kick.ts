import { 
    PermissionFlagsBits, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { Appeals } from '../../utils/Appeals';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';
export default class Kick extends Command {
	constructor(client: ExtendedClient) {
		super(client, {
			name: 'kick',
			description: {
				content: 'Kick a member from the server with an optional rejoin invite.',
				usage: 'kick <user> [reason] [--invite|-i]',
				examples: ['kick @User Disrespectful', 'kick @User 24h warning --invite', 'kick @User -i']
			},
			category: 'moderation',
			cooldown: 3,
			slashCommand: true,
			permissions: {
				user: [PermissionFlagsBits.KickMembers],
				client: [PermissionFlagsBits.KickMembers]
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
				},
				{
					name: 'invite',
					description: 'Attach a 1-time rejoin invite link in the DM before kicking',
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		});
	}

	public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        // 1. Check Invite Flag
        const slashInvite = ctx.isInteraction ? ctx.options.getBoolean('invite') : false;
        const prefixInvite = args.some(a => ['--invite', '--i', '-i'].includes(a.toLowerCase()));
        const isInvite = Boolean(slashInvite || prefixInvite);

        // 2. Parse Clean Args & Target
        const cleanArgs = args.filter(a => !['--invite', '--i', '-i', '--force', '-f'].includes(a.toLowerCase()));
        const target = await Resolver.resolveMember(ctx, cleanArgs[0]);
		const reason = ctx.options.getString('reason') || cleanArgs.slice(1).join(' ') || 'No reason provided';

		if (!target) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Member Not Found`,
				description: 'Could not find that member in this server.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

		if (target.id === ctx.author.id) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: 'You cannot kick yourself from the server.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

        if (target.id === ctx.guild.ownerId) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Invalid Action`,
				description: 'You cannot kick the server owner.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
        }

		const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
		const isBotOwner = BOT_OWNERS.has(ctx.author.id);
		if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Hierarchy Violation`,
				description: 'You cannot kick someone with a higher or equal role to you.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

		if (!target.kickable) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Bot Hierarchy Error`,
				description: 'My role position is below this user. Move my role higher to enable moderation.', 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}

		const force = args.includes('--force') || args.includes('-f');
		const confirmed = await ModConfirmation.ask({
			client,
			ctx,
			actionName: isInvite ? 'Kick Member (w/ Rejoin Invite)' : 'Kick Member',
			targetName: `${target.user.tag} (${target.id})`,
			targetAvatar: target.user.displayAvatarURL(),
			dangerLevel: 'danger',
			reason: isInvite ? `${reason} [Rejoin invite will be sent in DM]` : reason,
			confirmLabel: 'Confirm Kick',
			confirmEmoji: client.emoji?.mod_kick || '👢',
			force
		});

		if (!confirmed) return;

		try {
            // 1. Generate Invite if requested
            let inviteLink: string | null = null;
            if (isInvite) {
                try {
                    const clientMember = ctx.guild.members.me || await ctx.guild.members.fetchMe().catch(() => null);
                    let inviteChannel: any = null;

                    if (ctx.channel && 'createInvite' in ctx.channel && clientMember?.permissionsIn(ctx.channel as any).has(PermissionFlagsBits.CreateInstantInvite)) {
                        inviteChannel = ctx.channel;
                    } else if (ctx.guild.rulesChannel && clientMember?.permissionsIn(ctx.guild.rulesChannel).has(PermissionFlagsBits.CreateInstantInvite)) {
                        inviteChannel = ctx.guild.rulesChannel;
                    } else if (ctx.guild.systemChannel && clientMember?.permissionsIn(ctx.guild.systemChannel).has(PermissionFlagsBits.CreateInstantInvite)) {
                        inviteChannel = ctx.guild.systemChannel;
                    } else {
                        inviteChannel = ctx.guild.channels.cache.find((c: any) => 
                            c.isTextBased() && 
                            'createInvite' in c && 
                            clientMember?.permissionsIn(c).has(PermissionFlagsBits.CreateInstantInvite)
                        );
                    }

                    if (inviteChannel && typeof inviteChannel.createInvite === 'function') {
                        const invite = await inviteChannel.createInvite({
                            maxAge: 86400, // 24 hours
                            maxUses: 1,
                            unique: true,
                            reason: `Rejoin invite for kicked user ${target.user.tag} by ${ctx.author.tag}`
                        });
                        inviteLink = invite.url;
                    }
                } catch (err) {
                    console.error('Failed to create rejoin invite:', err);
                }
            }

            // 2. Send DM before kicking (with invite attached if requested)
            const dmSent = await Appeals.sendAppealDM(client, target.user, ctx.guild!, 'KICK', reason, inviteLink);
            
            // 3. Kick member
			await target.kick(`Kicked by ${ctx.author.tag}: ${reason}`);
			
            // 4. Create moderation case
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild!,
                type: 'KICK',
                target: target.user,
                moderator: ctx.author,
                reason: isInvite ? `${reason} (Rejoin invite sent)` : reason
            });

            // 5. Response formatting
            let inviteNotice = '';
            if (isInvite) {
                if (inviteLink) {
                    inviteNotice = dmSent 
                        ? `\n• **Rejoin Invite:** Sent via DM ([Link](${inviteLink}))`
                        : `\n• **Rejoin Invite:** [${inviteLink}](${inviteLink}) *(User DM closed)*`;
                } else {
                    inviteNotice = `\n• **Rejoin Invite:** Failed to generate (missing CreateInstantInvite permission)`;
                }
            }

			return await ctx.replyV2({
				title: `${client.emoji.mod_kick} Member Kicked`,
				description: 
					`**${target.user.tag}** has been kicked from the server.\n\n` +
					`• **Moderator:** <@${ctx.author.id}>\n` +
					`• **Target:** <@${target.id}> (\`${target.id}\`)\n` +
					`• **Case:** \`#${newCase.caseNumber}\`\n` +
					`• **Reason:** ${reason}` +
                    inviteNotice,
				borderless: true,
				color: null,
				allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
			});
		} catch (error: any) {
			return await ctx.replyV2({ 
				title: `${client.emoji.cross} Execution Error`, 
				description: `Failed to execute kick: ${error.message}`, 
				borderless: true, 
				color: null, 
				isAlert: true,
				allowedMentions: { parse: [], roles: [], users: [ctx.author.id], repliedUser: false }
			});
		}
	}
}
