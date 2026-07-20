import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const oldest = await prisma.auditLog.findFirst({
            orderBy: { createdAt: 'asc' }
        });
        const newest = await prisma.auditLog.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        
        console.log("Oldest Log in SQLite Bak:", oldest?.createdAt);
        console.log("Newest Log in SQLite Bak:", newest?.createdAt);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
