import {
    EmbedBuilder,
    ApplicationCommandOptionType,
    AttachmentBuilder
} from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';
import { Resolver } from '../../utils/Resolver';
import { RankCardGenerator } from '../../utils/RankCardGenerator';

export default class Stats extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'stats',
            description: {
                content: 'Server engagement statistics and member rankings.',
                usage: 'stats <subcommand>',
                examples: ['stats user', 'stats leaderboard', 'stats level']
            },
            category: 'utility',
            cooldown: 5,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'Check message count for a specific user.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'target', description: 'User to check', type: ApplicationCommandOptionType.User, required: false }
                    ]
                },
                {
                    name: 'level',
                    description: 'View your current level and XP status card.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'target', description: 'User to check', type: ApplicationCommandOptionType.User, required: false }
                    ]
                },
                {
                    name: 'leaderboard',
                    description: 'Display server rankings for various categories.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'category',
                            description: 'Rankings category',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Invites', value: 'invite' },
                                { name: 'Messages', value: 'messages' },
                                { name: 'Leveling', value: 'level' }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<any> {
        await ctx.deferReply();
        const sub = ctx.options.getSubcommand() || args[0];

        switch (sub) {
            case 'user':
                return this.handleUser(client, ctx, args);
            case 'level':
                return this.handleLevel(client, ctx, args);
            case 'leaderboard':
                return this.handleLeaderboard(client, ctx);
            default:
                return ctx.replyV2({ description: 'Please specify a valid statistics category.', isAlert: true });
        }
    }

    private async handleUser(client: ExtendedClient, ctx: Context, args: string[]) {
        const member = await Resolver.resolveMember(ctx, ctx.options.getMember('target') || args[1]);
        const target = member?.user || ctx.author;

        const data = await client.prisma.member.findUnique({
            where: { guildId_userId: { guildId: ctx.guild.id, userId: target.id } }
        });

        if (!data) {
            return await ctx.replyV2({ description: `**${target.tag}** has no message history here.`, color: client.color.red });
        }

        return await ctx.replyV2({
            title: ` Message Statistics`,
            description: `**User:** ${target.tag}\n**ID:** \`${target.id}\``,
            fields: [{ name: 'Total Messages', value: `> \`${data.messages}\` units`, inline: true }],
            color: client.color.main
        });
    }

    private async handleLevel(client: ExtendedClient, ctx: Context, args: string[]) {
        const member = await Resolver.resolveMember(ctx, ctx.options.getMember('target') || args[1]) || ctx.member!;
        const user = member.user;

        const [data, guild] = await Promise.all([
            client.prisma.member.findUnique({
                where: { guildId_userId: { guildId: ctx.guild.id, userId: user.id } }
            }),
            client.db.getLevelConfig(ctx.guild.id)
        ]);

        if (!data) {
            return await ctx.replyV2({ description: `**${user.tag}** has no leveling records.`, color: client.color.red });
        }

        const rank = await client.prisma.member.count({
            where: { guildId: ctx.guild.id, xp: { gt: data.xp } }
        }) + 1;

        const calcLevelXP = (lvl: number) => Math.floor((18 * Math.pow(lvl, 2) + 200 * lvl) * (guild?.xpFormulaMultiplier ?? 1.0));
        const nextLevelXP = calcLevelXP(data.level + 1);

        try {
            const cardBuffer = await RankCardGenerator.generate({
                username: user.username,
                avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
                level: data.level,
                rank: rank,
                currentXp: data.xp,
                requiredXp: nextLevelXP,
                color: guild?.rankCardProgressColor || undefined,
            });

            const attachment = new AttachmentBuilder(cardBuffer, { name: `rank-${user.id}.png` });
            return await ctx.reply({ files: [attachment] });
        } catch {
            return await ctx.replyV2({
                title: ` Rank Information`,
                description: `**Level ${data.level}** \u2022 **Rank #${rank}**\nXP: \`${data.xp}\` / \`${nextLevelXP}\``,
                color: client.color.main
            });
        }
    }

    private async handleLeaderboard(client: ExtendedClient, ctx: Context) {
        const type = ctx.options.getString('category') || 'messages';

        let title = '';
        let description = '';

        switch (type) {
            case 'invite':
                title = 'Invite Leaderboard';
                const topInvites = await client.prisma.member.findMany({
                    where: { guildId: ctx.guild.id, invites: { gt: 0 } },
                    orderBy: { invites: 'desc' },
                    take: 10
                });
                description = topInvites.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 \`${m.invites}\` joins`).join('\n');
                break;
            case 'level':
                title = 'Global Rank Leaderboard';
                const topLevels = await client.prisma.member.findMany({
                    where: { guildId: ctx.guild.id, xp: { gt: 0 } },
                    orderBy: { xp: 'desc' },
                    take: 10
                });

                const userLevelData = await client.prisma.member.findUnique({
                    where: { guildId_userId: { guildId: ctx.guild.id, userId: ctx.author.id } }
                });

                const userRank = userLevelData ? (await client.prisma.member.count({
                    where: { guildId: ctx.guild.id, xp: { gt: userLevelData.xp } }
                }) + 1) : 0;

                description = topLevels.length > 0
                    ? topLevels.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 Level \`${m.level}\` (\`${m.xp}\` XP)`).join('\n')
                    : 'No leveling data available yet.';

                if (userLevelData && userLevelData.xp > 0) {
                    description += `\n\n**Your Rank**\n**#${userRank}** <@${ctx.author.id}> \u2022 Level \`${userLevelData.level}\` (\`${userLevelData.xp}\` XP)`;
                }
                break;
            case 'messages':
            default:
                title = 'Message Leaderboard';
                const topMessages = await client.prisma.member.findMany({
                    where: { guildId: ctx.guild.id, messages: { gt: 0 } },
                    orderBy: { messages: 'desc' },
                    take: 10
                });
                description = topMessages.map((m, i) => `**#${i + 1}** <@${m.userId}> \u2022 \`${m.messages}\` messages`).join('\n');
                break;
        }

        return await ctx.replyV2({
            title: `**${title}**`,
            description: description || 'No data available yet.',
            color: client.color.main,
            footer: 'Selection refreshed in real-time'
        });
    }
}
