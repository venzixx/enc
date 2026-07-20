import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        const count = await prisma.auditLog.count({
            where: { guildId: guildId }
        });
        console.log(`Final Logs for ${guildId}:`, count);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
