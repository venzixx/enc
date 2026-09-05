import { 
    PermissionFlagsBits, 
    ApplicationCommandOptionType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { CaseManager } from '../../utils/CaseManager';
import { ModConfirmation } from '../../utils/ModConfirmation';

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
                client: []
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
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Server Only`,
                description: 'This command can only be used in a server.', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        let caseNumber = 0;
        let newReason = '';

        if (ctx.isInteraction) {
            caseNumber = ctx.options.getInteger('case', true);
            newReason = ctx.options.getString('reason', true);
        } else {
            if (!args[0] || isNaN(parseInt(args[0], 10))) {
                return await ctx.replyV2({ 
                    title: `${client.emoji.cross} Missing Case Number`,
                    description: 'Please provide a valid case number.\n**Usage:** `.editwarn <case_number> <new_reason>`', 
                    borderless: true, 
                    color: null, 
                    isAlert: true 
                });
            }

            caseNumber = parseInt(args[0], 10);
            newReason = args.slice(1).join(' ').trim();
        }

        if (!newReason) {
            return await ctx.replyV2({ 
                title: `${client.emoji.cross} Missing Reason`,
                description: 'Please provide a new reason.\n**Usage:** `.editwarn <case_number> <new_reason>`', 
                borderless: true, 
                color: null, 
                isAlert: true 
            });
        }

        const existing = await client.prisma.case.findFirst({
            where: { guildId: ctx.guild.id, caseNumber }
        });

        if (!existing) {
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
            actionName: 'Edit Case Reason',
            targetName: `Case #${caseNumber} (${existing.type})`,
            dangerLevel: 'primary',
            details: `Target: ${existing.targetTag || 'Unknown'} (${existing.targetId})\nOld Reason: ${existing.reason}\nNew Reason: ${newReason}`,
            confirmLabel: 'Confirm Update',
            confirmEmoji: '✏️',
            force
        });

        if (!confirmed) return;

        const result = await CaseManager.editCase(client, ctx.guild.id, caseNumber, newReason);

        if (!result) {
            return await ctx.replyV2({
                title: `${client.emoji.cross} Update Failed`,
                description: `Failed to update case **#${caseNumber}**.`,
                borderless: true,
                color: null,
                isAlert: true
            });
        }

        const { previous, updated } = result;

        return await ctx.replyV2({
            title: `✏️ Case #${caseNumber} Reason Updated`,
            description: 
                `Updated **${updated.type}** case **#${caseNumber}**.\n\n` +
                `• **Target:** <@${updated.targetId}> (\`${updated.targetId}\`)\n` +
                `• **Editor:** <@${ctx.author.id}>\n` +
                `• **Previous Reason:** ${previous.reason}\n` +
                `• **New Reason:** ${updated.reason}`,
            borderless: true,
            color: null,
            allowedMentions: { parse: [], roles: [], users: [updated.targetId, ctx.author.id], repliedUser: false }
        });
    }
}
