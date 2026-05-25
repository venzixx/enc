import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ComponentType 
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class MentionCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'mention',
            aliases: ['mn'],
            description: {
                content: 'Show the recent mentions you have gotten.',
                usage: 'mention list',
                examples: ['mention list', 'mn list']
            },
            category: 'utility',
            cooldown: 3,
            slashCommand: true,
            options: []
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        const sub = args[0]?.toLowerCase() || 'list';
        if (sub !== 'list') {
            return ctx.replyV2({ description: '**Usage:** `mention list` or `mn list`', isAlert: true });
        }

        const mentions = await (client.prisma as any).userMention.findMany({
            where: { userId: ctx.author.id },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        if (mentions.length === 0) {
            return ctx.replyV2({ description: 'You do not have any saved mentions yet.', color: client.color.main });
        }

        const itemsPerPage = 5;
        const totalPages = Math.ceil(mentions.length / itemsPerPage);
        let currentPage = 0;

        const buildEmbed = (page: number) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = mentions.slice(start, end);

            const lines = pageItems.map((m: any, i: number) => {
                const globalIndex = start + i + 1;
                const timeStr = `<t:${Math.floor(new Date(m.createdAt).getTime() / 1000)}:R>`;
                const jumpUrl = `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`;
                const typeText = m.isReply ? '💬 Replied to you' : '🔔 Mentioned you';
                const snippet = m.content ? `\n> ${m.content}` : '';
                return `**${globalIndex}.** ${typeText} in <#${m.channelId}> by **${m.authorTag}** ${timeStr}\n[Jump to message](${jumpUrl})${snippet}`;
            });

            return new EmbedBuilder()
                .setTitle(`Saved Mentions (${mentions.length} total)`)
                .setDescription(lines.join('\n\n'))
                .setColor(client.color.main)
                .setFooter({ text: `Page ${page + 1} of ${totalPages} • Requested by ${ctx.author.tag}` })
                .setTimestamp();
        };

        const buildButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('mention_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('mention_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1)
            );
            return [row];
        };

        const embed = buildEmbed(currentPage);
        const components = totalPages > 1 ? buildButtons(currentPage) : [];

        const message = await ctx.sendMessage({
            embeds: [embed],
            components
        });

        if (totalPages <= 1 || !message || !('createMessageComponentCollector' in message)) return;

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000,
            filter: (i) => i.user.id === ctx.author.id
        });

        collector.on('collect', async (i: any) => {
            try {
                await i.deferUpdate();
            } catch (err) {
                console.error('Failed to defer update:', err);
            }

            if (i.customId === 'mention_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'mention_next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await ctx.editMessage({
                embeds: [buildEmbed(currentPage)],
                components: buildButtons(currentPage)
            });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('mention_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('mention_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            ctx.editMessage({ components: [disabledRow] }).catch(() => {});
        });
    }
}
