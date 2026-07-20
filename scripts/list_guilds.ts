import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guilds = await prisma.guild.findMany();
        guilds.forEach(g => {
            console.log(`ID: ${g.id}, Name: ${g.name}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
