import { ExtendedClient } from "../client";
import logger from "../structures/Logger";
import { GiveawayManager } from "../utils/GiveawayManager";

export async function startGiveawayScheduler(client: ExtendedClient): Promise<void> {
    logger.info("[Giveaway] Scheduler started.");

    let running = false;
    setInterval(async () => {
        if (running) return;
        running = true;
        try {
            const expiredGiveaways = await client.prisma.giveaway.findMany({
                where: {
                    guildId: { in: [...client.guilds.cache.keys()] },
                    OR: [{ isActive: true, endTime: { lte: new Date() } }, { announcementPending: true }]
                }
            });

            for (const giveaway of expiredGiveaways) {
                try {
                    await GiveawayManager.endGiveaway(client, giveaway.id);
                } catch (err) {
                    logger.error(`[Giveaway] Error ending giveaway ${giveaway.id}:`, err);
                }
            }
        } catch (err) {
            logger.error("[Giveaway] Scheduler error:", err);
        } finally {
            running = false;
        }
    }, 5000); // Runs every 5 seconds
}