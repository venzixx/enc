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

export default class Cases extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'cases',
            description: {
                content: 'View moderation cases for the server or filtered by type/user.',
                usage: 'cases [warn/ban/kick/mute/all] [@user] [page]',
                examples: [
                    'cases',
                    'cases warn',
                    'cases ban',
                    'cases @User',
                    'cases warn @User',
                    'cases 2'
                ]
            },
            category: 'moderation',
            aliases: ['modcases', 'punishments', 'infractions', 'history'],
            cooldown: 3,
            slashCommand: true,
            permissions: {
                user: [PermissionFlagsBits.ModerateMembers],
                client: [PermissionFlagsBits.EmbedLinks]
            },
            options: [
                {
                    name: 'type',
                    description: 'Filter cases by action type',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'All Actions', value: 'all' },
                        { name: 'Warnings (WARN)', value: 'warn' },
                        { name: 'Bans (BAN)', value: 'ban' },
                        { name: 'Kicks (KICK)', value: 'kick' },
                        { name: 'Mutes (MUTE)', value: 'mute' },
                        { name: 'Unbans (UNBAN)', value: 'unban' },
                        { name: 'Unmutes (UNMUTE)', value: 'unmute' },
                    ]
                },
                {
                    name: 'user',
                    description: 'Filter cases for a specific user',
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: 'page',
                    description: 'Page number to view',
                    type: ApplicationCommandOptionType.Integer,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();

        if (!ctx.guild) {
            return await ctx.replyV2({ description: 'This command can only be used in a server.', color: client.color.red, isAlert: true });
        }

        let filterType: string | undefined = undefined;
        let targetUser: any = null;
        let page = 1;

        if (ctx.isInteraction) {
            filterType = ctx.options.getString('type') || undefined;
            targetUser = ctx.options.getUser('user');
            page = ctx.options.getInteger('page') || 1;
        } else {
            const rawArgs = [...args];
            
            // Check for page number in args
            const pageIndex = rawArgs.findIndex(a => /^\d+$/.test(a) && parseInt(a, 10) < 1000 && !a.startsWith('<@'));
            if (pageIndex !== -1) {
                page = parseInt(rawArgs.splice(pageIndex, 1)[0], 10);
            }

            // Check for action type in args
            const types = ['warn', 'ban', 'kick', 'mute', 'unban', 'unmute', 'timeout', 'all'];
            const typeIndex = rawArgs.findIndex(a => types.includes(a.toLowerCase()));
            if (typeIndex !== -1) {
                filterType = rawArgs.splice(typeIndex, 1)[0].toLowerCase();
            }

            // Check for user in remaining args
            if (rawArgs.length > 0) {
                targetUser = await Resolver.resolveUser(ctx, rawArgs[0]);
            }
        }

        if (filterType === 'all') filterType = undefined;

        const pageSize = 6;
        let currentPage = Math.max(1, page);

        const result = await CaseManager.getCases(client, ctx.guild.id, {
            type: filterType,
            targetId: targetUser?.id,
            page: currentPage,
            limit: pageSize
        });

        if (result.total === 0) {
            const filterDesc = [
                filterType ? `type **${filterType.toUpperCase()}**` : '',
                targetUser ? `for **${targetUser.tag}**` : ''
            ].filter(Boolean).join(' ');

            return await ctx.replyV2({
                title: '🛡️ No Cases Found',
                description: `No moderation cases found ${filterDesc ? `${filterDesc} ` : ''}in this server.`,
                color: client.color.main
            });
        }

        const renderEmbed = (p: number, data: any) => {
            const titleParts = ['Moderation Cases'];
            if (filterType) titleParts.push(`[${filterType.toUpperCase()}]`);
            if (targetUser) titleParts.push(`• ${targetUser.tag}`);

            const embed = new EmbedBuilder()
                .setTitle(`🛡️ ${titleParts.join(' ')} (${data.total} total)`)
                .setColor(client.color.main)
                .setFooter({ text: `Page ${p} of ${data.totalPages} • Total Cases: ${data.total} • Use .case <id> for details` })
                .setTimestamp();

            const descriptionLines = data.cases.map((c: any) => {
                const emoji = CaseManager.getActionEmoji(c.type);
                const time = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`;
                return `**#${c.caseNumber}** ${emoji} **${c.type}** | **Target:** ${c.targetTag || c.targetId} (\`${c.targetId}\`)\n` +
                       `└ **Mod:** ${c.moderatorTag || 'Unknown'} • **Reason:** ${c.reason.length > 60 ? `${c.reason.substring(0, 57)}...` : c.reason} • ${time}`;
            });

            embed.setDescription(descriptionLines.join('\n\n'));
            return embed;
        };

        const renderButtons = (p: number, totalPages: number) => {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('cases_first')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(p <= 1),
                new ButtonBuilder()
                    .setCustomId('cases_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(p <= 1),
                new ButtonBuilder()
                    .setCustomId('cases_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(p >= totalPages),
                new ButtonBuilder()
                    .setCustomId('cases_last')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(p >= totalPages)
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

            if (i.customId === 'cases_first') {
                currentPage = 1;
            } else if (i.customId === 'cases_prev' && currentPage > 1) {
                currentPage--;
            } else if (i.customId === 'cases_next' && currentPage < result.totalPages) {
                currentPage++;
            } else if (i.customId === 'cases_last') {
                currentPage = result.totalPages;
            }

            const newResult = await CaseManager.getCases(client, ctx.guild!.id, {
                type: filterType,
                targetId: targetUser?.id,
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
