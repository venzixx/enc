import { ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import { ExtendedClient } from "../client";
import logger from "../structures/Logger";
import { V2Helper } from "../utils/V2Helper";

export async function startGiveawayScheduler(client: ExtendedClient): Promise<void> {
    logger.info("[Giveaway] Scheduler started.");

    setInterval(async () => {
        try {
            const expiredGiveaways = await client.prisma.giveaway.findMany({
                where: {
                    isActive: true,
                    endTime: { lte: new Date() }
                },
                include: { entries: true }
            });

            for (const giveaway of expiredGiveaways) {
                try {
                    // Mark as inactive first to prevent double-processing
                    await client.prisma.giveaway.update({
                        where: { id: giveaway.id },
                        data: { isActive: false }
                    });

                    const guild = client.guilds.cache.get(giveaway.guildId);
                    if (!guild) continue;

                    const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
                    if (!channel) continue;

                    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                    if (!message) continue;

                    const entries = giveaway.entries;

                    // No entries case
                    if (entries.length === 0) {
                        const noWinnersLayout = V2Helper.createLayout({
                            title: `🎉 Giveaway Ended: ${giveaway.prize}`,
                            description: `No one entered the giveaway. There are no winners.\n\n**Hosted by:** <@${giveaway.hostId}>`,
                            color: client.color.red,
                            buttons: [
                                new ButtonBuilder()
                                    .setCustomId('giveaway_enter')
                                    .setLabel('Giveaway Ended')
                                    .setEmoji('🎉')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            ]
                        });

                        await message.edit(noWinnersLayout as any);
                        await channel.send({
                            content: `🎉 **Giveaway Ended:** No one entered for **${giveaway.prize}**.`
                        });
                        continue;
                    }

                    // Pick winners using weight algorithm (Bonus Entries)
                    const pool: typeof entries[0][] = [];
                    for (const entry of entries) {
                        const w = Math.max(1, (entry as any).weight || 1);
                        for (let i = 0; i < w; i++) pool.push(entry);
                    }
                    
                    const shuffled = pool.sort(() => Math.random() - 0.5);
                    const winners = Array.from(new Set(shuffled)).slice(0, Math.min(giveaway.winnersCount, entries.length));
                    const winnerMentions = winners.map(w => `<@${w.userId}>`).join(', ');

                    // Edit the original giveaway message
                    const endedLayout = V2Helper.createLayout({
                        title: `🎉 Giveaway Ended: ${giveaway.prize}`,
                        description: `**Winner(s):** ${winnerMentions}\n**Hosted by:** <@${giveaway.hostId}>`,
                        color: client.color.main,
                        buttons: [
                            new ButtonBuilder()
                                .setCustomId('giveaway_enter')
                                .setLabel('Giveaway Ended')
                                .setEmoji('🎉')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        ]
                    });

                    await message.edit(endedLayout as any);

                    // Announce winners
                    await channel.send({
                        content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`
                    });

                    logger.info(`[Giveaway] Ended giveaway "${giveaway.prize}" in guild ${giveaway.guildId}. Winners: ${winners.map(w => w.userId).join(', ')}`);
                } catch (err) {
                    logger.error(`[Giveaway] Error ending giveaway ${giveaway.id}:`, err);
                }
            }
        } catch (err) {
            logger.error("[Giveaway] Scheduler error:", err);
        }
    }, 10000); // Runs every 10 seconds
}