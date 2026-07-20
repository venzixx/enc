import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        const config = await prisma.antiNukeConfig.findUnique({
            where: { guildId: guildId }
        });
        console.log(`AntiNuke for ${guildId}:`, config);

        const autoMod = await prisma.autoModFilter.findMany({
            where: { guildId: guildId }
        });
        console.log(`AutoMod Filters for ${guildId}:`, autoMod.length);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
