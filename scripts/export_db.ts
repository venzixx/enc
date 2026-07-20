import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const models = [
    'guild', 'commandAlias', 'appeal', 'userConfig', 'giveawayBlacklist', 'giveawayBonusEntry',
    'starboardMessage', 'extraOwner', 'whitelistedUser', 'whitelistedRole', 'stickyMessage',
    'story', 'member', 'channel', 'ignoredChannel', 'autoResponse', 'reactionRole',
    'giveaway', 'giveawayEntry', 'birthday', 'customRole', 'djRole', 'playlist', 'track',
    'confession', 'afk', 'afkMention', 'ticketConfig', 'ticketPanelOption', 'ticket',
    'voiceConfig', 'tempVoice', 'suggestion', 'suggestionVote', 'auditLog', 'permit',
    'autoModFilter', 'autoModWhitelist', 'antiNukeConfig', 'levelRole', 'roleBooster',
    'channelBooster', 'roleConnection', 'streakTier', 'userStreak', 'userDailyActivity',
    'channelDailyActivity', 'reactionDailyActivity', 'voiceDailyActivity', 'autoReact',
    'reactLock', 'uwuLock', 'devUser', 'devMute', 'forcedNickname', 'socialAction',
    'savedEmbed', 'componentAction'
];

async function main() {
    const dumpDir = path.join(__dirname, 'dump');
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir);
    }

    for (const model of models) {
        console.log(`Exporting ${model}...`);
        try {
            const data = await (prisma as any)[model].findMany();
            fs.writeFileSync(
                path.join(dumpDir, `${model}.json`),
                JSON.stringify(data, (key, value) => 
                    typeof value === 'bigint' ? value.toString() : value, 
                2)
            );
            console.log(`Successfully exported ${data.length} records for ${model}.`);
        } catch (error) {
            console.error(`Failed to export ${model}:`, error);
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
