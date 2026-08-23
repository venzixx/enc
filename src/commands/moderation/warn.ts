import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    GuildMember, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';

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
                client: [PermissionFlagsBits.EmbedLinks]
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
            return await ctx.replyV2({ description: 'This command can only be used in a server.', color: client.color.red, isAlert: true });
        }

        const target = await Resolver.resolveMember(ctx);
        let reason = '';

        if (ctx.isInteraction) {
            reason = ctx.options.getString('reason', true);
        } else {
            reason = args.slice(1).join(' ').trim();
        }

        if (!target) {
            return await ctx.replyV2({ description: 'Could not find that member in this server.', color: client.color.red, isAlert: true });
        }

        if (!reason) {
            return await ctx.replyV2({ description: 'Please provide a valid reason for the warning.\n**Usage:** `.warn <@user> <reason>`', color: client.color.red, isAlert: true });
        }

        if (target.id === ctx.author.id) {
            return await ctx.replyV2({ description: 'You cannot warn yourself.', color: client.color.red, isAlert: true });
        }

        if (target.user.bot) {
            return await ctx.replyV2({ description: 'You cannot warn bots.', color: client.color.red, isAlert: true });
        }

        const BOT_OWNERS = new Set<string>(['903646482610126848', '994411485977653248', '865906211948724226']);
        const isBotOwner = BOT_OWNERS.has(ctx.author.id);

        if (ctx.author.id !== ctx.guild.ownerId && !isBotOwner && target.roles.highest.position >= (ctx.member as GuildMember).roles.highest.position) {
            return await ctx.replyV2({ description: 'Hierarchy Violation: You cannot warn someone with a higher or equal role.', color: client.color.red, isAlert: true });
        }

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
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${client.emoji.mod_warn} Warning from ${ctx.guild.name}`)
                    .setDescription(`You have received a warning in **${ctx.guild.name}**.`)
                    .addFields(
                        { name: 'Case ID', value: `\`#${newCase.caseNumber}\``, inline: true },
                        { name: 'Moderator', value: `${ctx.author.tag}`, inline: true },
                        { name: 'Total Warnings', value: `\`${totalWarns}\``, inline: true },
                        { name: 'Reason', value: reason }
                    )
                    .setColor(client.color.main)
                    .setTimestamp();

                await target.user.send({ embeds: [dmEmbed] }).catch(() => null);
            } catch {
                // Ignore DM failure if user has DMs closed
            }

            // Reply with Wick-style clean confirmation embed
            const embed = new EmbedBuilder()
                .setAuthor({ name: `Member Warned • Case #${newCase.caseNumber}`, iconURL: target.user.displayAvatarURL() })
                .setDescription(`**${target.user.tag}** has been warned.`)
                .addFields(
                    { name: `${client.emoji.user} User`, value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
                    { name: `${client.emoji.shield} Moderator`, value: `${ctx.author.tag} (\`${ctx.author.id}\`)`, inline: true },
                    { name: `${client.emoji.mod_warn} Total Warns`, value: `\`${totalWarns}\``, inline: true },
                    { name: `${client.emoji.mic} Reason`, value: reason }
                )
                .setColor(client.color.main)
                .setFooter({ text: `Case #${newCase.caseNumber} • Use .case ${newCase.caseNumber} to view details` })
                .setTimestamp();

            return await ctx.reply({ embeds: [embed] });
        } catch (error: any) {
            return await ctx.replyV2({ title: 'Execution Error', description: `Failed to issue warning: ${error.message}`, color: client.color.red, isAlert: true });
        }
    }
}
