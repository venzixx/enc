import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guildId = '1493521070584500354';
        const newPrefix = '??';
        
        console.log(`Updating prefix for ${guildId} to ${newPrefix}...`);
        
        await prisma.guild.update({
            where: { id: guildId },
            data: { prefix: newPrefix }
        });
        
        const updatedGuild = await prisma.guild.findUnique({
            where: { id: guildId }
        });
        
        console.log("Updated Prefix:", updatedGuild?.prefix);
        
        // Change it back
        await prisma.guild.update({
            where: { id: guildId },
            data: { prefix: ',' }
        });
        console.log("Restored Prefix: ,");

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
