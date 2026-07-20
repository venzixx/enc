import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    
    try {
        const guildCount = await prisma.guild.count();
        console.log("Guild count:", guildCount);
        
        const memberCount = await prisma.member.count();
        console.log("Member count:", memberCount);
        
        const guilds = await prisma.guild.findMany({ take: 5 });
        console.log("Guilds IDs:", guilds.map(g => g.id));
        
    } catch (error) {
        console.error("Prisma Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
