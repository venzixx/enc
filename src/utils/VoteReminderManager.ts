import { ExtendedClient } from '../client';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';

export class VoteReminderManager {
    private static interval: NodeJS.Timeout | null = null;

    /**
     * Initializes the background vote reminder interval (runs every 60s).
     */
    public static init(client: ExtendedClient) {
        if (this.interval) clearInterval(this.interval);

        this.interval = setInterval(async () => {
            await this.checkReminders(client);
        }, 60 * 1000);

        // Run once on startup
        this.checkReminders(client).catch(() => {});
    }

    /**
     * Checks for pending vote reminders that reached the 12-hour threshold.
     */
    public static async checkReminders(client: ExtendedClient) {
        try {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

            // Find users who have remindMe: true, reminderSent: false, and lastVotedAt <= 12 hours ago
            const pendingReminders = await client.prisma.userVote.findMany({
                where: {
                    remindMe: true,
                    reminderSent: false,
                    lastVotedAt: {
                        lte: twelveHoursAgo,
                        not: null
                    }
                }
            });

            for (const record of pendingReminders) {
                try {
                    const user = await client.users.fetch(record.userId).catch(() => null);
                    if (user) {
                        const voteUrl = `https://top.gg/bot/${client.user?.id || '1493482964246593556'}/vote`;
                        
                        const voteButton = new ButtonBuilder()
                            .setLabel('Vote on Top.gg')
                            .setStyle(ButtonStyle.Link)
                            .setURL(voteUrl);

                        const disableButton = new ButtonBuilder()
                            .setCustomId(`vote_remind_off_${user.id}`)
                            .setLabel('Disable Reminders')
                            .setStyle(ButtonStyle.Secondary);

                        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton, disableButton);

                        const embed = new EmbedBuilder()
                            .setTitle(`${client.emoji.starboard_star || '⭐'} Top.gg Vote Ready!`)
                            .setDescription(
                                `Hey **${user.username}**! 12 hours have passed since your last vote.\n\n` +
                                `You can now vote for **${client.user?.username || 'Enc'}** again on Top.gg!\n` +
                                `Your support helps us grow and keep features online.`
                            )
                            .setColor(client.color.main || 0x5865F2)
                            .setFooter({ text: `Total Votes: ${record.totalVotes} • Enc Vote Reminder` })
                            .setTimestamp();

                        await user.send({ embeds: [embed], components: [row] }).catch(() => null);
                    }

                    // Mark reminder as sent
                    await client.prisma.userVote.update({
                        where: { userId: record.userId },
                        data: { reminderSent: true }
                    });
                } catch (userErr) {
                    console.error(`[VoteReminder] Failed to send reminder to ${record.userId}:`, userErr);
                }
            }
        } catch (error) {
            console.error('[VoteReminder] Error checking vote reminders:', error);
        }
    }
}
