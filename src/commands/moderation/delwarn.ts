import { 
    PermissionFlagsBits, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

export default class DelWarn extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'delwarn',
            aliases: ['removewarn', 'unwarn', 'rmwarn', 'delcase'],
            description: {
                content: 'Delete a warning or moderation case by case number.',
                usage: 'delwarn <case_number>',
                examples: ['delwarn 5', 'unwarn 12']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ModerateMembers],
                client: []
            },
            options: [
                {
                    name: 'case',
                    description: 'The case number to delete',
                    type: ApplicationCommandOptionType.Integer,
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

        let caseNumber = 0;

        if (ctx.isInteraction) {
            caseNumber = ctx.options.getInteger('case', true);
        } else {
            if (!args[0] || isNaN(parseInt(args[0], 10))) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Missing Case Number`,
                    description: 'Please provide a valid case number to delete.\n**Usage:** `.delwarn <case_number>`', 
                    borderless: true, 
                    color: null, 
                    isAlert: true 
                });
            }

            caseNumber = parseInt(args[0], 10);
        }

        const targetCase = await client.prisma.case.findFirst({
            where: { guildId: ctx.guild.id, caseNumber }
        });

        if (!targetCase) {
            return await ctx.replyV2({
                title: `${client.emoji.cross} Case Not Found`,
                description: `Case **#${caseNumber}** was not found in this server.`,
                borderless: true,
                color: null,
                isAlert: true
            });
        }

        const force = args.includes('--force') || args.includes('-f');
        const confirmed = await ModConfirmation.ask({
            client,
            ctx,
            actionName: 'Delete Case / Warning',
            targetName: `Case #${caseNumber} (${targetCase.type})`,
            dangerLevel: 'warning',
            details: `Target: ${targetCase.targetTag || 'Unknown'} (${targetCase.targetId})\nReason: ${targetCase.reason}`,
            confirmLabel: 'Confirm Delete Case',
            confirmEmoji: '🗑️',
            force
        });

        if (!confirmed) return;

        const deletedCase = await CaseManager.deleteCase(client, ctx.guild.id, caseNumber);

        if (!deletedCase) {
            return await ctx.replyV2({
                title: `${client.emoji.cross} Action Failed`,
                description: `Case **#${caseNumber}** could not be deleted.`,
                borderless: true,
                color: null,
                isAlert: true
            });
        }

        return await ctx.replyV2({
            title: `🗑️ Case #${caseNumber} Deleted`,
            description: 
                `Deleted **${deletedCase.type}** case **#${caseNumber}**.\n\n` +
                `• **Target:** <@${deletedCase.targetId}> (\`${deletedCase.targetId}\`)\n` +
                `• **Deleted By:** <@${ctx.author.id}>\n` +
                `• **Original Reason:** ${deletedCase.reason}`,
            borderless: true,
            color: null,
            allowedMentions: { parse: [], roles: [], users: Array.from(new Set([deletedCase.targetId, ctx.author.id].filter(Boolean))), repliedUser: false }
        });
    }
}
