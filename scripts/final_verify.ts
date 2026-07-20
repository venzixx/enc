import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const antiNuke = await prisma.antiNukeConfig.findMany();
        const autoMod = await prisma.autoModFilter.findMany();
        
        console.log("AntiNuke Records:", antiNuke.length);
        antiNuke.forEach(a => console.log(`  Guild: ${a.guildId}, Enabled: ${a.enabled}`));
        
        console.log("AutoMod Records:", autoMod.length);
        autoMod.forEach(m => console.log(`  Guild: ${m.guildId}, Type: ${m.type}`));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
