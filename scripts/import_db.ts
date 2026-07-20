import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const modelsOrder = [
    'guild',
    'userConfig',
    'ignoredChannel',
    'extraOwner',
    'whitelistedUser',
    'whitelistedRole',
    'autoResponse',
    'reactionRole',
    'story',
    'birthday',
    'customRole',
    'djRole',
    'playlist',
    'track',
    'confession',
    'afk',
    'afkMention',
    'ticketConfig',
    'ticketPanelOption',
    'ticket',
    'voiceConfig',
    'tempVoice',
    'suggestion',
    'suggestionVote',
    'auditLog',
    'permit',
    'autoModFilter',
    'autoModWhitelist',
    'antiNukeConfig',
    'levelRole',
    'roleBooster',
    'channelBooster',
    'roleConnection',
    'streakTier',
    'userStreak',
    'userDailyActivity',
    'channelDailyActivity',
    'reactionDailyActivity',
    'voiceDailyActivity',
    'autoReact',
    'reactLock',
    'uwuLock',
    'devUser',
    'devMute',
    'forcedNickname',
    'socialAction',
    'savedEmbed',
    'componentAction',
    'member',
    'channel',
    'giveaway',
    'giveawayEntry',
    'starboardMessage',
    'appeal',
    'commandAlias'
];

async function main() {
    const dumpDir = path.join(__dirname, 'dump');
    if (!fs.existsSync(dumpDir)) {
        console.error("Dump directory not found. Run export script first.");
        return;
    }

    // Disable foreign key checks for PostgreSQL if possible, or just use order
    // Order should be enough.

    for (const model of modelsOrder) {
        const filePath = path.join(dumpDir, `${model}.json`);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${model}, no dump found.`);
            continue;
        }

        console.log(`Importing ${model}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        if (data.length === 0) {
            console.log(`No records for ${model}.`);
            continue;
        }

        try {
            // Using createMany for performance
            // Note: PostgreSQL supports createMany
            const result = await (prisma as any)[model].createMany({
                data: data,
                skipDuplicates: true,
            });
            console.log(`Successfully imported ${result.count} records for ${model}.`);
        } catch (error) {
            console.error(`Failed to import ${model}:`, error);
            console.log(`Trying individual inserts for ${model}...`);
            let successCount = 0;
            for (const item of data) {
                try {
                    await (prisma as any)[model].create({ data: item });
                    successCount++;
                } catch (e) {
                    // Skip duplicates or log error
                }
            }
            console.log(`Imported ${successCount}/${data.length} records for ${model}.`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
