import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        
        console.log("Creating/Updating AutoMod filter...");
        await prisma.autoModFilter.upsert({
            where: { guildId: guildId },
            update: { enabled: true },
            create: { guildId: guildId, enabled: true }
        });
        
        const filter = await prisma.autoModFilter.findUnique({
            where: { guildId: guildId }
        });
        console.log("Filter enabled:", filter?.enabled);
        
        // Change back
        await prisma.autoModFilter.update({
            where: { guildId: guildId },
            data: { enabled: false }
        });
        console.log("Restored filter to disabled.");

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
