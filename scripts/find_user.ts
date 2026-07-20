import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Searching for user LRVENYX...");
        // Assuming there is no Tag field, I'll search for it in logs or something
        const logs = await prisma.auditLog.findMany({
            where: {
                executorTag: {
                    contains: 'LRVENYX',
                    mode: 'insensitive'
                }
            }
        });
        
        console.log(`Found ${logs.length} logs for this user.`);
        logs.forEach(l => {
            console.log(`Guild: ${l.guildId}, UserID: ${l.executorId}, Tag: ${l.executorTag}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
