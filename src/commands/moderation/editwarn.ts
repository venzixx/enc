import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { CaseManager } from '../../utils/CaseManager';

export default class EditWarn extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'editwarn',
            aliases: ['editreason', 'reason', 'editcase'],
            description: {
                content: 'Edit the reason for an existing moderation case.',
                usage: 'editwarn <case_number> <new_reason>',
                examples: ['editwarn 5 Updated reason for inappropriate language', 'reason 12 Accidental warning given']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ModerateMembers],
                client: [PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'case',
                    description: 'The case number to edit',
                    type: ApplicationCommandOptionType.Integer,
                    required: true
                },
                {
                    name: 'reason',
                    description: 'The updated reason for the case',
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

        let caseNumber = 0;
        let newReason = '';

        if (ctx.isInteraction) {
            caseNumber = ctx.options.getInteger('case', true);
            newReason = ctx.options.getString('reason', true);
        } else {
            if (!args[0] || isNaN(parseInt(args[0], 10))) {
                return await ctx.replyV2({ description: 'Please provide a valid case number.\n**Usage:** `.editwarn <case_number> <new_reason>`', color: client.color.red, isAlert: true });
            }

            caseNumber = parseInt(args[0], 10);
            newReason = args.slice(1).join(' ').trim();
        }

        if (!newReason) {
            return await ctx.replyV2({ description: 'Please provide a new reason.\n**Usage:** `.editwarn <case_number> <new_reason>`', color: client.color.red, isAlert: true });
        }

        const result = await CaseManager.editCase(client, ctx.guild.id, caseNumber, newReason);

        if (!result) {
            return await ctx.replyV2({
                description: `Case **#${caseNumber}** was not found in this server.`,
                color: client.color.red,
                isAlert: true
            });
        }

        const { previous, updated } = result;
        const emoji = CaseManager.getActionEmoji(updated.type);

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Case #${caseNumber} Updated`, iconURL: ctx.guild.iconURL() || undefined })
            .setDescription(`${emoji} Moderation **${updated.type}** case reason has been updated.`)
            .addFields(
                { name: '👤 Target', value: `${updated.targetTag || 'Unknown'} (\`${updated.targetId}\`)`, inline: true },
                { name: '🛡️ Editor', value: `${ctx.author.tag} (\`${ctx.author.id}\`)`, inline: true },
                { name: '📝 Previous Reason', value: previous.reason },
                { name: '✨ New Reason', value: updated.reason }
            )
            .setColor(client.color.main)
            .setFooter({ text: `Case #${caseNumber} • Originally logged by ${updated.moderatorTag || 'Unknown'}` })
            .setTimestamp();

        return await ctx.reply({ embeds: [embed] });
    }
}
