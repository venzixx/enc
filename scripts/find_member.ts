import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const members = await prisma.member.findMany({
            where: {
                lastUsername: {
                    contains: 'LRVENYX',
                    mode: 'insensitive'
                }
            }
        });
        
        console.log(`Found ${members.length} members with this name.`);
        members.forEach(m => {
            console.log(`Guild: ${m.guildId}, UserID: ${m.userId}, XP: ${m.xp}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
