import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const groups = await prisma.member.groupBy({
            by: ['guildId'],
            _count: {
                userId: true
            },
            _sum: {
                xp: true
            }
        });
        console.log("SQLITE Member XP by Guild:");
        groups.forEach(g => {
            console.log(`Guild: ${g.guildId}, Member Count: ${g._count.userId}, Total XP: ${g._sum.xp}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
