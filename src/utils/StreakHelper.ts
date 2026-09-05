import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { ExtendedClient } from '../client';
import { V2Helper } from './V2Helper';

export class StreakHelper {
    public static async buildUserStreaksLayout(
        client: ExtendedClient,
        guildId: string,
        targetUser: { id: string; username: string; displayAvatarURL: (opts?: any) => string },
        requesterId: string
    ) {
        const guild = await client.prisma.guild.findUnique({
            where: { id: guildId }
        });

        const tiers = await client.prisma.streakTier.findMany({
            where: { guildId },
            orderBy: { threshold: 'asc' }
        });

        const lbButton = new ButtonBuilder()
            .setCustomId(`streaks_lb_${guildId}`)
            .setLabel('Leaderboard')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary);

        const myStreaksButton = new ButtonBuilder()
            .setCustomId(`streaks_user_${guildId}_${requesterId}`)
            .setLabel('My Streaks')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Primary);

        const buttons = targetUser.id === requesterId 
            ? [lbButton] 
            : [myStreaksButton, lbButton];

        if (!tiers || tiers.length === 0) {
            return V2Helper.createLayout({
                title: '🔥 Server Streaks',
                description: `### No Streak Tiers Configured\n\nThis server does not have any streak tiers set up yet.\nServer managers can create tiers using \`/config streaktier add\`.`,
                borderless: true,
                color: null,
                buttons
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date(Date.now() - 86400000);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        const [activity, streaks] = await Promise.all([
            client.prisma.userDailyActivity.findUnique({
                where: { guildId_userId_date: { guildId, userId: targetUser.id, date: today } }
            }),
            client.prisma.userStreak.findMany({
                where: { guildId, userId: targetUser.id },
                include: { tier: true }
            })
        ]);

        const todayCount = activity?.messageCount || 0;
        const statusNote = !guild?.streaksEnabled 
            ? '\n⚠️ *Note: Streak tracking is currently paused in this server.*\n' 
            : '';

        let desc = `### ${targetUser.username}'s Streaks\n`;
        desc += `👤 **User:** <@${targetUser.id}>\n`;
        desc += `💬 **Today's Activity:** \`${todayCount} messages\`\n`;
        if (statusNote) desc += statusNote;
        desc += '\n';

        for (const tier of tiers) {
            const userStreak = streaks.find(s => s.tierId === tier.id);
            let current = userStreak?.currentStreak || 0;
            let longest = userStreak?.longestStreak || 0;
            let status = '';

            if (userStreak?.lastActiveDate === today) {
                status = '✅ *Completed today*';
            } else if (userStreak?.lastActiveDate === yesterday) {
                const remaining = Math.max(0, tier.threshold - todayCount);
                status = remaining === 0 
                    ? '⏳ *Reached threshold!*' 
                    : `⏳ *Pending today* (${todayCount}/${tier.threshold} • ${remaining} left)`;
            } else if (userStreak) {
                current = 0; // Broken
                const remaining = Math.max(0, tier.threshold - todayCount);
                status = remaining === 0 
                    ? '⏳ *Reached threshold!*' 
                    : `❌ *Streak broken* (${todayCount}/${tier.threshold} • ${remaining} left)`;
            } else {
                const remaining = Math.max(0, tier.threshold - todayCount);
                status = remaining === 0 
                    ? '⏳ *Reached threshold!*' 
                    : `🔒 *Not started* (${todayCount}/${tier.threshold} • ${remaining} left)`;
            }

            desc += `**${tier.name}** (${tier.threshold} msgs/day)\n`;
            desc += `• Current: **${current} days** ${current > 0 ? '🔥' : ''} — ${status}\n`;
            desc += `• Best Record: **${longest} days** 🏆\n\n`;
        }

        return V2Helper.createLayout({
            title: '🔥 Streak Progress',
            description: desc.trim(),
            thumbnail: targetUser.displayAvatarURL({ forceStatic: false }),
            borderless: true,
            color: null,
            buttons
        });
    }

    public static async buildLeaderboardLayout(
        client: ExtendedClient,
        guildId: string,
        requesterId: string
    ) {
        const topStreaks = await client.prisma.userStreak.findMany({
            where: {
                guildId,
                currentStreak: { gt: 0 }
            },
            include: {
                tier: true
            },
            orderBy: [
                { currentStreak: 'desc' },
                { longestStreak: 'desc' }
            ],
            take: 10
        });

        const myStreaksButton = new ButtonBuilder()
            .setCustomId(`streaks_user_${guildId}_${requesterId}`)
            .setLabel('My Streaks')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Primary);

        let desc = '### 🏆 Server Streak Leaderboard\n\n';

        if (topStreaks.length === 0) {
            desc += '*No active streaks currently recorded in this server.*\n*Chat today to claim the top spot on the leaderboard!*';
        } else {
            const medals = ['🥇', '🥈', '🥉'];
            topStreaks.forEach((stk, idx) => {
                const rank = medals[idx] || `\`#${idx + 1}\``;
                desc += `${rank} <@${stk.userId}> — **${stk.currentStreak} days** 🔥 (${stk.tier.name})\n`;
                desc += `   -# Best Record: \`${stk.longestStreak} days\` • Threshold: \`${stk.tier.threshold} msgs/day\`\n`;
            });
        }

        return V2Helper.createLayout({
            title: '🏆 Streak Hall of Fame',
            description: desc.trim(),
            borderless: true,
            color: null,
            buttons: [myStreaksButton]
        });
    }
}
