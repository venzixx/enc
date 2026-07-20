import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const totalLogs = await prisma.auditLog.count();
        console.log(`Total Audit logs: ${totalLogs}`);
        
        const sampleLogs = await prisma.auditLog.findMany({ take: 5 });
        sampleLogs.forEach(l => {
            console.log(`Guild: ${l.guildId}, Type: ${l.type}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
