import { ExtendedClient } from "../client";

export class StreakManager {
    public static async processMessage(client: ExtendedClient, guildId: string, userId: string, channelId: string): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date(Date.now() - 86400000);
            const yesterday = yesterdayDate.toISOString().split('T')[0];

            // 0. Fetch guild config
            const guild = await client.prisma.guild.findUnique({
                where: { id: guildId }
            });

            if (!guild || !guild.streaksEnabled) return;

            // 1. Update daily activities
            const [activity] = await Promise.all([
                client.prisma.userDailyActivity.upsert({
                    where: { guildId_userId_date: { guildId, userId, date: today } },
                    update: { messageCount: { increment: 1 } },
                    create: { guildId, userId, date: today, messageCount: 1 }
                }),
                client.prisma.channelDailyActivity.upsert({
                    where: { guildId_channelId_date: { guildId, channelId, date: today } },
                    update: { messageCount: { increment: 1 } },
                    create: { guildId, channelId, date: today, messageCount: 1 }
                }),
                client.prisma.channel.upsert({
                    where: { id: channelId },
                    update: { name: (client.channels.cache.get(channelId) as any)?.name || "unknown-channel" },
                    create: { id: channelId, guildId, name: (client.channels.cache.get(channelId) as any)?.name || "unknown-channel" }
                })
            ]);

            // 2. Fetch configured streak tiers
            const tiers = await client.prisma.streakTier.findMany({
                where: { guildId }
            });

            if (tiers.length === 0) return; // No tiers configured

            const streakChannel = guild.streakChannelId ? client.channels.cache.get(guild.streakChannelId) : null;

            // 3. Check each tier
            for (const tier of tiers) {
                // We only award the streak exactly when they hit the threshold for the day.
                if (activity.messageCount === tier.threshold) {
                    // Fetch existing streak
                    const userStreak = await client.prisma.userStreak.findUnique({
                        where: {
                            guildId_userId_tierId: {
                                guildId,
                                userId,
                                tierId: tier.id
                            }
                        }
                    });

                    let newStreakCount = 1;
                    let isNew = false;
                    let isMaintained = false;

                    if (!userStreak) {
                        // First time hitting this tier!
                        await client.prisma.userStreak.create({
                            data: {
                                guildId,
                                userId,
                                tierId: tier.id,
                                currentStreak: 1,
                                longestStreak: 1,
                                lastActiveDate: today
                            }
                        });
                        newStreakCount = 1;
                        isNew = true;
                    } else {
                        // Compare lastActiveDate
                        if (userStreak.lastActiveDate === today) {
                            // Already awarded today
                            continue;
                        } else if (userStreak.lastActiveDate === yesterday) {
                            // Maintained streak!
                            newStreakCount = userStreak.currentStreak + 1;
                            await client.prisma.userStreak.update({
                                where: { id: userStreak.id },
                                data: {
                                    currentStreak: newStreakCount,
                                    longestStreak: Math.max(userStreak.longestStreak, newStreakCount),
                                    lastActiveDate: today
                                }
                            });
                            isMaintained = true;
                        } else {
                            // Streak broken :( Reset to 1.
                            await client.prisma.userStreak.update({
                                where: { id: userStreak.id },
                                data: {
                                    currentStreak: 1,
                                    lastActiveDate: today
                                }
                            });
                            newStreakCount = 1;
                            isNew = true;
                        }
                    }

                    // Send notification
                    if (streakChannel?.isTextBased()) {
                        const user = await client.users.fetch(userId);
                        if (isNew) {
                            (streakChannel as any).send({
                                content: `🔥 **${user.username}** started a **${tier.name}** streak! (Threshold: ${tier.threshold} msgs/day)`
                            }).catch(() => {});
                        } else if (isMaintained) {
                            (streakChannel as any).send({
                                content: `🔥 **${user.username}** maintained their **${tier.name}** streak for **${newStreakCount} days**!`
                            }).catch(() => {});
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error in StreakManager:", error);
        }
    }
}
