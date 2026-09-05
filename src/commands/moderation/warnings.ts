import { 
    PermissionFlagsBits, 
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';
import { V2Helper } from '../../utils/V2Helper';

export default class Warnings extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'warnings',
            aliases: ['warns'],
            description: {
                content: 'View all active warnings for a member.',
                usage: 'warnings [@user]',
                examples: ['warnings', 'warnings @User', 'warnings 1234567890']
            },
            category: 'moderation',
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [],
                client: []
            },
            options: [
                {
                    name: 'user',
                    description: 'The member to view warnings for (defaults to you)',
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, _args: string[]): Promise<any> {
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

        let targetUser = await Resolver.resolveUser(ctx);
        if (!targetUser) {
            targetUser = ctx.author;
        }

        const pageSize = 5;
        let currentPage = 1;

        let result = await CaseManager.getCases(client, ctx.guild.id, {
            type: 'WARN',
            targetId: targetUser.id,
            activeOnly: true,
            page: currentPage,
            limit: pageSize
        });

        if (result.total === 0) {
            return await ctx.replyV2({
                title: `${client.emoji.shield || '🛡️'} Clean Record`,
                description: `**${targetUser.tag}** has no active warnings in this server.`,
                thumbnail: targetUser.displayAvatarURL(),
                borderless: true,
                color: null
            });
        }

        const renderLayout = (page: number, data: any, withButtons = true) => {
            const lines = data.cases.map((c: any) => {
                const time = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`;
                return `**Case #${c.caseNumber}** (${time})\n• **Moderator:** ${c.moderatorTag || 'Unknown'}\n• **Reason:** ${c.reason}\n`;
            });

            const buttons = (withButtons && data.totalPages > 1) ? [
                new ButtonBuilder()
                    .setCustomId('warns_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId('warns_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= data.totalPages)
            ] : undefined;

            return V2Helper.createLayout({
                title: `⚠️ Warnings for ${targetUser!.tag}`,
                description: lines.join('\n'),
                footer: `Page ${page} of ${data.totalPages} • Total Active Warnings: ${data.total}`,
                thumbnail: targetUser!.displayAvatarURL(),
                borderless: true,
                color: null,
                buttons
            });
        };

        const layout = renderLayout(currentPage, result, result.totalPages > 1);
        const msg = await ctx.replyV2(layout as any);

        if (result.totalPages <= 1) return;

        const collector = (msg as any)?.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        if (!collector) return;

        collector.on('collect', async (i: any) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({ content: 'Only the command author can change pages.', ephemeral: true });
            }

            if (i.customId === 'warns_prev' && currentPage > 1) {
                currentPage--;
            } else if (i.customId === 'warns_next' && currentPage < result.totalPages) {
                currentPage++;
            }

            result = await CaseManager.getCases(client, ctx.guild!.id, {
                type: 'WARN',
                targetId: targetUser!.id,
                activeOnly: true,
                page: currentPage,
                limit: pageSize
            });

            await i.update(renderLayout(currentPage, result, true) as any);
        });

        collector.on('end', async () => {
            try {
                if (ctx.isInteraction && ctx.interaction) {
                    await ctx.interaction.editReply(renderLayout(currentPage, result, false) as any);
                } else if ((msg as any)?.editable) {
                    await (msg as any).edit(renderLayout(currentPage, result, false) as any);
                }
            } catch {
                // Ignore if message deleted
            }
        });
    }
}
