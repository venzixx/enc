
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

// The new 10k messages = Level 100 formula
const calcLevelXP = (lvl: number) => Math.floor(18 * Math.pow(lvl, 2) + 200 * lvl);

async function recalculate() {
    console.log("Starting level recalculation sync...");

    const members = await prisma.member.findMany({
        where: { xp: { gt: 0 } }
    });

    console.log(`Found ${members.length} members to update.`);

    for (const member of members) {
        let level = 0;
        while (member.xp >= calcLevelXP(level + 1)) {
            level++;
        }

        if (level !== member.level) {
            console.log(`Updating ${member.userId}: Level ${member.level} -> ${level} (${member.xp} XP)`);
            await prisma.member.update({
                where: { id: member.id },
                data: { level }
            });
        }
    }

    console.log("Recalculation complete!");
    process.exit(0);
}

recalculate().catch(err => {
    console.error("Recalculation failed:", err);
    process.exit(1);
});
