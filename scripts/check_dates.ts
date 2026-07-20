import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const oldest = await prisma.auditLog.findFirst({
            orderBy: { createdAt: 'asc' }
        });
        const newest = await prisma.auditLog.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        
        console.log("Oldest Log:", oldest?.createdAt);
        console.log("Newest Log:", newest?.createdAt);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
