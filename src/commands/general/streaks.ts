import { ApplicationCommandOptionType, EmbedBuilder, GuildMember } from 'discord.js';
import { Command, Context } from '../../structures';
import { ExtendedClient } from '../../client';

export default class StreaksCommand extends Command {
    constructor(client: ExtendedClient) {
        super(client, {
            name: 'streaks',
            description: {
                content: 'View your message streaks.',
                usage: 'streaks [user]',
                examples: ['streaks', 'streaks @user']
            },
            category: 'general',
            cooldown: 5,
            slashCommand: true,
            options: [
                {
                    name: 'user',
                    description: 'The user to view streaks for',
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        });
    }

    public async run(client: ExtendedClient, ctx: Context, args: string[]): Promise<void> {
        const target = ctx.options.getUser('user') || ctx.author;

        // Fetch streaks
        const streaks = await client.prisma.userStreak.findMany({
            where: {
                guildId: ctx.guild!.id,
                userId: target.id
            },
            include: {
                tier: true
            }
        });

        if (streaks.length === 0) {
            await ctx.reply({ content: `**${target.username}** does not have any active or recorded streaks in this server. Chat to build up streaks!` });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${client.emoji.streak_fire} ${target.username}'s Streaks`)
            .setColor(client.color.main)
            .setThumbnail(target.displayAvatarURL({ forceStatic: false }))
            .setTimestamp();

        let description = '';
        const today = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date(Date.now() - 86400000);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        // Sort streaks by threshold (hardest first)
        streaks.sort((a, b) => b.tier.threshold - a.tier.threshold);

        for (const streak of streaks) {
            // Lazy evaluation logic to display properly even if they haven't chatted today yet
            let current = streak.currentStreak;
            let status = '';

            if (streak.lastActiveDate === today) {
                status = '✅ (Completed today)';
            } else if (streak.lastActiveDate === yesterday) {
                status = '⏳ (Pending for today)';
            } else {
                current = 0; // Broken
                status = '❌ (Streak broken)';
            }

            description += `**${streak.tier.name}** (${streak.tier.threshold} msgs/day)\n`;
            description += `Current: **${current} days** ${status}\n`;
            description += `Longest: **${streak.longestStreak} days**\n\n`;
        }

        embed.setDescription(description || 'No streaks found.');

        await ctx.reply({ embeds: [embed] });
    }
}
