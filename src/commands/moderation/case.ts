import { 
    PermissionFlagsBits, 
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
                client: []
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
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Server Only`,
                description: 'This command can only be used in a server.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        let caseNumber = 0;

        if (ctx.isInteraction) {
            caseNumber = ctx.options.getInteger('number', true);
        } else {
            // Handle prefix: `.case show 1` or `.case 1`
            const numStr = args.find(a => /^\d+$/.test(a));
            if (!numStr) {
                return await ctx.replyV2({
                    title: `${client.emoji.cross} Missing Case Number`,
                    description: 'Please provide a valid case number.\n**Usage:** `.case show <number>` or `.case <number>`',
                    borderless: true,
                    color: null,
                    isAlert: true
                });
            }
            caseNumber = parseInt(numStr, 10);
        }

        const caseData = await CaseManager.getCase(client, ctx.guild.id, caseNumber);

        if (!caseData) {
            return await ctx.replyV2({
                title: `${client.emoji.shield || '🛡️'} Case Not Found`,
                description: `Case **#${caseNumber}** does not exist in this server.`,
                borderless: true,
                color: null,
                isAlert: true
            });
        }

        const emoji = CaseManager.getActionEmoji(caseData.type);
        const createdTimestamp = Math.floor(new Date(caseData.createdAt).getTime() / 1000);
        const isEdited = new Date(caseData.updatedAt).getTime() > new Date(caseData.createdAt).getTime() + 1000;

        const descLines = [
            `Detailed information for moderation case **#${caseData.caseNumber}**.\n`,
            `• **Target:** <@${caseData.targetId}> (\`${caseData.targetId}\`)`,
            `• **Moderator:** <@${caseData.moderatorId}> (\`${caseData.moderatorId}\`)`,
            `• **Action Type:** \`${caseData.type}\``,
            `• **Reason:** ${caseData.reason}`,
            `• **Date Issued:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
            `• **Status:** ${caseData.active ? '🟢 Active' : '🔴 Inactive / Cleared'}`
        ];

        if (caseData.duration) {
            descLines.push(`• **Duration:** \`${caseData.duration}\``);
        }

        if (isEdited) {
            const updatedTimestamp = Math.floor(new Date(caseData.updatedAt).getTime() / 1000);
            descLines.push(`• **Last Modified:** <t:${updatedTimestamp}:R>`);
        }

        return await ctx.replyV2({
            title: `${emoji} ${caseData.type} — Case #${caseData.caseNumber}`,
            description: descLines.join('\n'),
            footer: `Server: ${ctx.guild.name} • Case ID: ${caseData.id}`,
            borderless: true,
            color: null
        });
    }
}
