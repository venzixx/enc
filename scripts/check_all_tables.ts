import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const tables = [
            'guild', 'member', 'auditLog', 'commandAlias', 'antiNukeConfig', 
            'autoModFilter', 'streak', 'permit', 'appeals', 'ticket', 
            'poll', 'autoResponder', 'messageCount'
        ];

        for (const table of tables) {
            try {
                const count = await (prisma as any)[table].count();
                console.log(`${table}: ${count}`);
            } catch (e) {
                console.log(`${table}: Table not found or error`);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
