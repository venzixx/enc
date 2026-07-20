import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const groups = await prisma.auditLog.groupBy({
            by: ['guildId'],
            _count: {
                guildId: true
            }
        });
        console.log("SQLITE Audit Logs by Guild:");
        groups.forEach(g => {
            console.log(`Guild: ${g.guildId}, Count: ${g._count.guildId}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
