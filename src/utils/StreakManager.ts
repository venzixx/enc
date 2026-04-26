import { ExtendedClient } from "../client";

export class StreakManager {
    public static async processMessage(client: ExtendedClient, guildId: string, userId: string): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date(Date.now() - 86400000);
            const yesterday = yesterdayDate.toISOString().split('T')[0];

            // 1. Update daily activity
            const activity = await client.prisma.userDailyActivity.upsert({
                where: {
                    guildId_userId_date: {
                        guildId,
                        userId,
                        date: today
                    }
                },
                update: {
                    messageCount: { increment: 1 }
                },
                create: {
                    guildId,
                    userId,
                    date: today,
                    messageCount: 1
                }
            });

            // 2. Fetch configured streak tiers
            const tiers = await client.prisma.streakTier.findMany({
                where: { guildId }
            });

            if (tiers.length === 0) return; // No tiers configured

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
                        continue;
                    }

                    // Compare lastActiveDate
                    if (userStreak.lastActiveDate === today) {
                        // Already awarded today
                        continue;
                    } else if (userStreak.lastActiveDate === yesterday) {
                        // Maintained streak!
                        await client.prisma.userStreak.update({
                            where: { id: userStreak.id },
                            data: {
                                currentStreak: userStreak.currentStreak + 1,
                                longestStreak: Math.max(userStreak.longestStreak, userStreak.currentStreak + 1),
                                lastActiveDate: today
                            }
                        });
                    } else {
                        // Streak broken :( Reset to 1.
                        await client.prisma.userStreak.update({
                            where: { id: userStreak.id },
                            data: {
                                currentStreak: 1,
                                lastActiveDate: today
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error in StreakManager:", error);
        }
    }
}
