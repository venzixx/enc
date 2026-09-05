import { 
    PermissionFlagsBits, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class Warn extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'warn',
            description: {
                content: 'Warn a member in the server with a logged case.',
                usage: 'warn <@user> <reason>',
                examples: ['warn @User Inappropriate language in general', 'warn 1234567890 Spamming']
            },
            category: 'moderation',
            aliases: ['w'],
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ModerateMembers],
                client: []
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to warn',
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for the warning',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        if (!ctx.guild) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Server Only`,
                description: 'This command can only be used in a server.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        const target = await Resolver.resolveMember(ctx);
        let reason = '';

        if (ctx.isInteraction) {
            reason = ctx.options.getString('reason', true);
        } else {
            reason = args.slice(1).join(' ').trim();
        }

        if (!target) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Member Not Found`,
                description: 'Could not find that member in this server.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        if (!reason) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Missing Reason`,
                description: 'Please provide a valid reason for the warning.\n**Usage:** `.warn <@user> <reason>`', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        if (target.id === ctx.author.id) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Invalid Action`,
                description: 'You cannot warn yourself.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        if (target.user.bot) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Invalid Action`,
                description: 'You cannot warn bots.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        const isBotOwner = BOT_OWNERS.has(ctx.author.id);

        if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Hierarchy Violation`,
                description: 'You cannot warn someone with a higher or equal role to you.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        const force = args.includes('--force') || args.includes('-f');
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: 'Warn Member',
            targetName: `${target.user.tag} (${target.id})`,
            targetAvatar: target.user.displayAvatarURL(),
            dangerLevel: 'warning',
            reason,
            confirmLabel: 'Confirm Warn',
            confirmEmoji: client.emoji?.mod_warn || '⚠️',
            force
        });

        if (!confirmed) return;

        try {
            // Create the case record
            const newCase = await CaseManager.createCase(client, {
                guild: ctx.guild,
                type: 'WARN',
                target: target.user,
                moderator: ctx.author,
                reason
            });

            // Get updated warning count for this user
            const totalWarns = await CaseManager.getUserWarnCount(client, ctx.guild.id, target.id);

            // Try to DM the warned member
            try {
                await target.user.send({
                    content: `⚠️ You have received a warning in **${ctx.guild.name}** for: **${reason}** (Case #${newCase.caseNumber}).`
                }).catch(() => null);
            } catch {
                // Ignore DM failure if user has DMs closed
            }

            return await ctx.replyV2({
                title: `${client.emoji.mod_warn} Member Warned`,
                description: 
                    `**${target.user.tag}** has received a formal warning.\n\n` +
                    `• **Moderator:** <@${ctx.author.id}>\n` +
                    `• **Target:** <@${target.id}> (\`${target.id}\`)\n` +
                    `• **Case:** \`#${newCase.caseNumber}\`\n` +
                    `• **Total Warnings:** \`${totalWarns}\`\n` +
                    `• **Reason:** ${reason}`,
                borderless: true,
                color: null,
                allowedMentions: { parse: [], roles: [], users: [target.id, ctx.author.id], repliedUser: false }
            });
        } catch (error: any) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Execution Error`, 
                description: `Failed to issue warning: ${error.message}`, 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }
    }
}
