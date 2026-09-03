import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
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

            if (!guild) return;

            // 1. Update daily activities (unconditional for stats/leaderboard)
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

            if (!guild.streaksEnabled) return;

            // 2. Fetch configured streak tiers — SORTED BY THRESHOLD (ascending)
            // This ensures Bronze (5) → Silver (15) → Gold (30) fires in correct order
            const tiers = await client.prisma.streakTier.findMany({
                where: { guildId },
                orderBy: { threshold: 'asc' }
            });

            if (tiers.length === 0) return;

            const streakChannel = guild.streakChannelId ? client.channels.cache.get(guild.streakChannelId) : null;

            // 3. Check each tier — only process the tier that matches current message count
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
                            // Already awarded today — skip this tier entirely
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
                        const tierAny = tier as any;

                        // Resolve message template with placeholders
                        const resolveTemplate = (template: string) => {
                            return template
                                .replace(/{user}/g, `<@${userId}>`)
                                .replace(/{user\.name}/g, user.username)
                                .replace(/{user\.mention}/g, `<@${userId}>`)
                                .replace(/{user\.id}/g, userId)
                                .replace(/{tier\.name}/g, tier.name)
                                .replace(/{streak\.count}/g, newStreakCount.toString())
                                .replace(/{streak\.longest}/g, (userStreak?.longestStreak || newStreakCount).toString())
                                .replace(/{tier\.threshold}/g, tier.threshold.toString());
                        };

                        // Check for custom embed data
                        if (tierAny.embedData) {
                            try {
                                const embedData = JSON.parse(tierAny.embedData);
                                const embed = new EmbedBuilder()
                                    .setColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0xFF6600)
                                    .setTimestamp();

                                if (embedData.title) embed.setTitle(resolveTemplate(embedData.title));
                                if (embedData.description) embed.setDescription(resolveTemplate(embedData.description));
                                if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
                                if (embedData.image?.url) embed.setImage(embedData.image.url);
                                if (embedData.footer?.text) embed.setFooter({ 
                                    text: resolveTemplate(embedData.footer.text),
                                    iconURL: embedData.footer.icon_url 
                                });

                                const sendData: any = { 
                                    content: `<@${userId}>`,
                                    embeds: [embed],
                                    allowedMentions: { users: [userId], parse: [], roles: [] }
                                };

                                // Attach image card if configured
                                if (tierAny.imageUrl) {
                                    embed.setImage(tierAny.imageUrl);
                                }

                                (streakChannel as any).send(sendData).catch(() => {});
                            } catch (e) {
                                console.error(`Failed to parse streak embed for tier ${tier.name}:`, e);
                            }
                        } else {
                            // Use custom template or fallback to default
                            let content: string;

                            if (tierAny.message) {
                                content = resolveTemplate(tierAny.message);
                            } else if (isNew) {
                                content = `${client.emoji.streak_fire} **${user.username}** started a **${tier.name}** streak! (Threshold: ${tier.threshold} msgs/day)`;
                            } else if (isMaintained) {
                                content = `${client.emoji.streak_fire} **${user.username}** maintained their **${tier.name}** streak for **${newStreakCount} days**!`;
                            } else {
                                continue;
                            }

                            (streakChannel as any).send({ 
                                content, 
                                allowedMentions: { users: [userId], parse: [], roles: [] } 
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
