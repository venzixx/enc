import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        const channels = await prisma.channel.findMany({
            where: { guildId: guildId }
        });
        
        console.log(`Channels for ${guildId}:`, channels.length);
        channels.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
