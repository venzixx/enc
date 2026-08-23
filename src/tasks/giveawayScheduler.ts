import { ExtendedClient } from "../client";
import logger from "../structures/Logger";
import { GiveawayManager } from "../utils/GiveawayManager";

export async function startGiveawayScheduler(client: ExtendedClient): Promise<void> {
    logger.info("[Giveaway] Scheduler started.");

    setInterval(async () => {
        try {
            const expiredGiveaways = await client.prisma.giveaway.findMany({
                where: {
                    isActive: true,
                    endTime: { lte: new Date() }
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
        }
    }, 5000); // Runs every 5 seconds
}