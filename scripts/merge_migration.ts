import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();

const postgres = new PrismaClient();
const sqliteFile = 'app/prisma/latest_inspect.db';

async function main() {
    const db = new sqlite3.Database(sqliteFile);
    const all = promisify(db.all).bind(db);

    console.log("--- Starting MERGE Migration from latest_inspect.db ---");

    // 1. Guilds
    const guilds = await all("SELECT * FROM Guild");
    console.log(`Found ${guilds.length} guilds in SQLite.`);
    for (const g of guilds as any[]) {
        await postgres.guild.upsert({
            where: { id: g.id },
            update: {},
            create: {
                id: g.id,
                prefix: g.prefix || '!',
                language: g.language || 'en'
            }
        });
    }

    // 2. AutoMod Filters
    const filters = await all("SELECT * FROM AutoModFilter");
    console.log(`Found ${filters.length} filters in SQLite.`);
    for (const f of filters as any[]) {
        try {
            await postgres.autoModFilter.create({
                data: {
                    guildId: f.guildId,
                    type: f.type,
                    enabled: f.enabled === 1,
                    actions: f.actions || '[]',
                    settings: f.settings || '{}'
                }
            });
        } catch (e) {
            console.log(`  Skipping filter for ${f.guildId} (already exists or error)`);
        }
    }

    // 3. AntiNuke Config
    const antiNuke = await all("SELECT * FROM AntiNukeConfig");
    console.log(`Found ${antiNuke.length} AntiNuke configs in SQLite.`);
    for (const a of antiNuke as any[]) {
        try {
            await postgres.antiNukeConfig.upsert({
                where: { guildId: a.guildId },
                update: {},
                create: {
                    guildId: a.guildId,
                    enabled: a.enabled === 1,
                    actions: a.actions || '[]',
                    settings: a.settings || '{}'
                }
            });
        } catch (e) {
             console.log(`  Error upserting AntiNuke for ${a.guildId}`);
        }
    }

    // 4. Audit Logs
    const logs = await all("SELECT * FROM AuditLog");
    console.log(`Found ${logs.length} logs in SQLite.`);
    let logCount = 0;
    for (const l of logs as any[]) {
        try {
            // Check if log already exists (by some heuristic since IDs might change)
            // But for simplicity, we'll just try to create and skip if it looks duplicate
            // Or better, we just add them all with new IDs
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
                    createdAt: l.createdAt ? new Date(parseInt(l.createdAt)) : new Date()
                }
            });
            logCount++;
        } catch (e) {
            // console.log(`  Error creating log: ${e}`);
        }
    }
    console.log(`Successfully merged ${logCount} logs.`);

    db.close();
    await postgres.$disconnect();
    console.log("--- MERGE Migration Finished ---");
}

main().catch(console.error);
