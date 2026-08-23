import { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ApplicationCommandOptionType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { CaseManager } from '../../utils/CaseManager';

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
                client: [PermissionFlagsBits.EmbedLinks]
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
            return await ctx.replyV2({ description: 'This command can only be used in a server.', color: client.color.red, isAlert: true });
        }

        let targetUser = await Resolver.resolveUser(ctx);
        if (!targetUser) {
            targetUser = ctx.author;
        }

        const pageSize = 5;
        let currentPage = 1;

        const result = await CaseManager.getCases(client, ctx.guild.id, {
            type: 'WARN',
            targetId: targetUser.id,
            activeOnly: true,
            page: currentPage,
            limit: pageSize
        });

        if (result.total === 0) {
            return await ctx.replyV2({
                title: '🛡️ Clean Record',
                description: `**${targetUser.tag}** has no active warnings in this server.`,
                color: client.color.main
            });
        }

        const renderEmbed = (page: number, data: any) => {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `Warnings for ${targetUser!.tag} (${data.total} total)`, iconURL: targetUser!.displayAvatarURL() })
                .setColor(client.color.main)
                .setFooter({ text: `Page ${page} of ${data.totalPages} • Total Warnings: ${data.total}` })
                .setTimestamp();

            const lines = data.cases.map((c: any) => {
                const time = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`;
                return `**Case #${c.caseNumber}** (${time})\n**Mod:** ${c.moderatorTag || 'Unknown'}\n**Reason:** ${c.reason}\n`;
            });

            embed.setDescription(lines.join('\n'));
            return embed;
        };

        const renderButtons = (page: number, totalPages: number) => {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('warns_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId('warns_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages)
            );
        };

        const embed = renderEmbed(currentPage, result);

        if (result.totalPages <= 1) {
            return await ctx.reply({ embeds: [embed] });
        }

        const row = renderButtons(currentPage, result.totalPages);
        const msg = await ctx.reply({ embeds: [embed], components: [row] });

        const collector = (msg as any).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i: any) => {
            if (i.user.id !== ctx.author.id) {
                return i.reply({ content: 'Only the command author can change pages.', ephemeral: true });
            }

            if (i.customId === 'warns_prev' && currentPage > 1) {
                currentPage--;
            } else if (i.customId === 'warns_next' && currentPage < result.totalPages) {
                currentPage++;
            }

            const newResult = await CaseManager.getCases(client, ctx.guild!.id, {
                type: 'WARN',
                targetId: targetUser!.id,
                activeOnly: true,
                page: currentPage,
                limit: pageSize
            });

            await i.update({
                embeds: [renderEmbed(currentPage, newResult)],
                components: [renderButtons(currentPage, newResult.totalPages)]
            });
        });

        collector.on('end', async () => {
            try {
                await (msg as any).edit({ components: [] });
            } catch {
                // Ignore edit error if message deleted
            }
        });
    }
}
