
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function recalculate() {
    console.log("Starting level recalculation sync...");

    // Fetch all guilds with their xpFormulaMultiplier
    const guilds = await prisma.guild.findMany({
        where: { levelingEnabled: true },
        select: { id: true, xpFormulaMultiplier: true }
    });

    console.log(`Found ${guilds.length} guilds with leveling enabled.`);

    let totalUpdated = 0;

    for (const guild of guilds) {
        const multiplier = (guild as any).xpFormulaMultiplier ?? 1.0;
        const calcLevelXP = (lvl: number) => Math.floor((18 * Math.pow(lvl, 2) + 200 * lvl) * multiplier);

        const members = await prisma.member.findMany({
            where: { guildId: guild.id, xp: { gt: 0 } }
        });

        for (const member of members) {
            let level = 0;
            let iterations = 0;
            while (member.xp >= calcLevelXP(level + 1) && iterations < 500) {
                level++;
                iterations++;
            }

            if (level !== member.level) {
                console.log(`[${guild.id}] ${member.userId}: Level ${member.level} -> ${level} (${member.xp} XP, multiplier: ${multiplier})`);
                await prisma.member.update({
                    where: { id: member.id },
                    data: { level }
                });
                totalUpdated++;
            }
        }
    }

    console.log(`\nRecalculation complete! Updated ${totalUpdated} members.`);
    process.exit(0);
}

recalculate().catch(err => {
    console.error("Recalculation failed:", err);
    process.exit(1);
});
