
import { PrismaClient } from '@prisma/client';
import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

async function backfill() {
    console.log("Starting backfill...");
    await client.login(process.env.TOKEN);
    console.log(`Logged in as ${client.user?.tag}`);

    const members = await prisma.member.findMany({
        where: {
            OR: [
                { lastUsername: null },
                { lastUsername: "" }
            ]
        }
    });

    console.log(`Found ${members.length} members to backfill.`);

    for (const member of members) {
        try {
            console.log(`Fetching user ${member.userId}...`);
            const user = await client.users.fetch(member.userId);
            if (user) {
                await prisma.member.update({
                    where: { id: member.id },
                    data: {
                        lastUsername: user.displayName || user.username,
                        lastAvatar: user.displayAvatarURL()
                    }
                });
                console.log(`Updated ${user.username}`);
            }
            // Add a small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to fetch user ${member.userId}:`, error);
        }
    }

    // Also backfill channels
    const channelsToBackfill = await prisma.channel.findMany({
        where: {
            OR: [
                { name: "unknown-channel" },
                { name: "" }
            ]
        }
    });

    console.log(`Found ${channelsToBackfill.length} channels to backfill.`);
    for (const channelData of channelsToBackfill) {
        try {
            const channel = await client.channels.fetch(channelData.id);
            if (channel && 'name' in channel) {
                await prisma.channel.update({
                    where: { id: channelData.id },
                    data: { name: (channel as any).name }
                });
                console.log(`Updated channel ${channelData.id} to ${(channel as any).name}`);
            }
        } catch (error) {
            console.error(`Failed to fetch channel ${channelData.id}:`, error);
        }
    }

    console.log("Backfill complete!");
    process.exit(0);
}

backfill();
