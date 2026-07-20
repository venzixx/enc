import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        const logCount = await prisma.auditLog.count({
            where: { guildId: guildId }
        });
        console.log(`Audit logs for ${guildId}: ${logCount}`);
        
        const firstLog = await prisma.auditLog.findFirst({
            where: { guildId: guildId }
        });
        console.log("First log sample:", firstLog);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
