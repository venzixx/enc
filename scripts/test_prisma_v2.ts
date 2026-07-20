import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const guilds = await prisma.guild.findMany();
        console.log("--- GUILDS ---");
        guilds.forEach(g => {
            console.log(`ID: ${g.id}, Prefix: ${g.prefix}, Log: ${g.logChannelId}`);
        });

        const members = await prisma.member.findMany({ take: 5 });
        console.log("--- MEMBERS (SAMPLE) ---");
        members.forEach(m => {
            console.log(`Guild: ${m.guildId}, User: ${m.userId}, XP: ${m.xp}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
