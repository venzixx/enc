import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const postgres = new PrismaClient();
const jsonFile = 'prisma/latest_data.json';

async function main() {
    if (!fs.existsSync(jsonFile)) {
        console.error("JSON file not found");
        return;
    }

    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    console.log("--- Starting IMPORT from JSON ---");

    // 1. Guilds
    for (const g of data.Guild || []) {
        await postgres.guild.upsert({
            where: { id: g.id },
            update: {},
            create: {
                id: g.id,
                prefix: g.prefix || 'e!'
            }
        });
    }
    console.log(`Synced ${data.Guild?.length || 0} Guilds`);

    // 2. Members
    for (const m of data.Member || []) {
        try {
            await postgres.member.upsert({
                where: { guildId_userId: { guildId: m.guildId, userId: m.userId } },
                update: {
                    xp: m.xp,
                    level: m.level,
                    messages: m.messages
                },
                create: {
                    guildId: m.guildId,
                    userId: m.userId,
                    xp: m.xp,
                    level: m.level,
                    messages: m.messages,
                    invites: m.invites || 0,
                    lastUsername: m.lastUsername,
                    lastAvatar: m.lastAvatar
                }
            });
        } catch (e) {
            console.error(`  Error syncing member ${m.userId}:`, e);
        }
    }
    console.log(`Synced ${data.Member?.length || 0} Members`);

    // 3. AutoMod
    for (const f of data.AutoModFilter || []) {
        try {
            const existing = await postgres.autoModFilter.findFirst({
                where: { guildId: f.guildId, type: f.type }
            });
            if (!existing) {
                await postgres.autoModFilter.create({
                    data: {
                        guildId: f.guildId,
                        type: f.type,
                        enabled: f.enabled === 1 || f.enabled === true,
                        actions: f.actions || '[]',
                        settings: f.settings || '{}'
                    }
                });
            }
        } catch (e) {
            console.error(`  Error syncing filter ${f.type}:`, e);
        }
    }
    console.log(`Synced ${data.AutoModFilter?.length || 0} Filters`);

    // 4. AntiNuke
    for (const a of data.AntiNukeConfig || []) {
        try {
            await postgres.antiNukeConfig.upsert({
                where: { guildId: a.guildId },
                update: {
                    enabled: a.enabled === 1 || a.enabled === true,
                    actions: a.actions,
                    settings: a.settings
                },
                create: {
                    guildId: a.guildId,
                    enabled: a.enabled === 1 || a.enabled === true,
                    actions: a.actions || '[]',
                    settings: a.settings || '{}'
                }
            });
        } catch (e) {
            console.error(`  Error syncing AntiNuke for ${a.guildId}:`, e);
        }
    }
    console.log(`Synced ${data.AntiNukeConfig?.length || 0} AntiNuke`);

    // 5. Audit Logs
    let logCount = 0;
    for (const l of data.AuditLog || []) {
        try {
            // We'll just create new entries for logs to be safe
            // Heuristic check for duplicates if needed
            await postgres.auditLog.create({
                data: {
                    guildId: l.guildId,
                    executorId: l.executorId,
                    executorTag: l.executorTag,
                    targetId: l.targetId,
                    targetName: l.targetName,
                    type: l.type,
                    event: l.event,
                    details: l.details,
                    createdAt: l.createdAt ? (typeof l.createdAt === 'number' ? new Date(l.createdAt) : new Date(l.createdAt)) : new Date()
                }
            });
            logCount++;
        } catch (e) {}
    }
    console.log(`Imported ${logCount} Audit Logs`);

    await postgres.$disconnect();
    console.log("--- IMPORT Finished ---");
}

main().catch(console.error);
