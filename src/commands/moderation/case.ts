import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { CaseManager } from '../../utils/CaseManager';

export default class CaseCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'case',
            description: {
                content: 'View full details of a specific moderation case.',
                usage: 'case <show/number> [number]',
                examples: ['case show 1', 'case 5']
            },
            category: 'moderation',
            aliases: ['modcase', 'infraction', 'showcase'],
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ModerateMembers],
                client: [PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'show',
                    description: 'Show details of a specific case number',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'number',
                            description: 'The case number to view',
                            type: ApplicationCommandOptionType.Integer,
                            required: true
                        }
                    ]
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

        if (ctx.isInteraction) {
            caseNumber = ctx.options.getInteger('number', true);
        } else {
            // Handle prefix: `.case show 1` or `.case 1`
            const numStr = args.find(a => /^\d+$/.test(a));
            if (!numStr) {
                return await ctx.replyV2({
                    description: 'Please provide a valid case number.\n**Usage:** `.case show <number>` or `.case <number>`',
                    color: client.color.red,
                    isAlert: true
                });
            }
            caseNumber = parseInt(numStr, 10);
        }

        const caseData = await CaseManager.getCase(client, ctx.guild.id, caseNumber);

        if (!caseData) {
            return await ctx.replyV2({
                title: '🛡️ Case Not Found',
                description: `Case **#${caseNumber}** does not exist in this server.`,
                color: client.color.red,
                isAlert: true
            });
        }

        const emoji = CaseManager.getActionEmoji(caseData.type);
        const createdTimestamp = Math.floor(new Date(caseData.createdAt).getTime() / 1000);
        const isEdited = new Date(caseData.updatedAt).getTime() > new Date(caseData.createdAt).getTime() + 1000;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Moderation Case #${caseData.caseNumber}`, iconURL: ctx.guild.iconURL() || undefined })
            .setTitle(`${emoji} ${caseData.type} — Case #${caseData.caseNumber}`)
            .setDescription(`Detailed information for moderation case **#${caseData.caseNumber}**.`)
            .addFields(
                { name: `${client.emoji.user} Target Member`, value: `${caseData.targetTag || 'Unknown'}\n\`${caseData.targetId}\` (<@${caseData.targetId}>)`, inline: true },
                { name: `${client.emoji.shield} Responsible Moderator`, value: `${caseData.moderatorTag || 'Unknown'}\n\`${caseData.moderatorId}\` (<@${caseData.moderatorId}>)`, inline: true },
                { name: `${client.emoji.mod_case} Action Type`, value: `\`${caseData.type}\``, inline: true },
                { name: `${client.emoji.mic} Reason`, value: caseData.reason },
                { name: `${client.emoji.clock_time} Date Issued`, value: `<t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`, inline: true },
                { name: `${client.emoji.status_dot_green} Status`, value: caseData.active ? `${client.emoji.status_dot_green} Active` : `${client.emoji.mod_stop} Inactive / Deleted`, inline: true }
            )
            .setColor(client.color.main)
            .setFooter({ text: `Server: ${ctx.guild.name} • Case ID: ${caseData.id}` })
            .setTimestamp();

        if (caseData.duration) {
            embed.addFields({ name: `${client.emoji.clock_time} Duration`, value: `\`${caseData.duration}\``, inline: true });
        }

        if (isEdited) {
            const updatedTimestamp = Math.floor(new Date(caseData.updatedAt).getTime() / 1000);
            embed.addFields({ name: `${client.emoji.edit} Last Modified`, value: `<t:${updatedTimestamp}:R>`, inline: true });
        }

        return await ctx.reply({ embeds: [embed] });
    }
}
