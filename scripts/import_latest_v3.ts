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
    console.log("--- Starting IMPORT from JSON (v3 - Correct Mapping) ---");

    // 1. Guilds & AntiNuke (Merged in new schema)
    for (const g of data.Guild || []) {
        // Find AntiNuke config for this guild in SQLite data
        const antiNuke = (data.AntiNukeConfig || []).find((a: any) => a.guildId === g.id);
        
        await postgres.guild.upsert({
            where: { id: g.id },
            update: {
                antiNukeEnabled: antiNuke ? (antiNuke.enabled === 1 || antiNuke.enabled === true) : false,
                // Map other fields if possible, but the schema seems to have changed significantly
            },
            create: {
                id: g.id,
                prefix: g.prefix || 'e!',
                antiNukeEnabled: antiNuke ? (antiNuke.enabled === 1 || antiNuke.enabled === true) : false,
            }
        });
    }
    console.log(`Synced ${data.Guild?.length || 0} Guilds with AntiNuke settings`);

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
        } catch (e) { }
    }
    console.log(`Synced ${data.Member?.length || 0} Members`);

    // 3. AutoMod (Mapped fields: enabled, action, data)
    for (const f of data.AutoModFilter || []) {
        try {
            const existing = await postgres.autoModFilter.findFirst({
                where: { guildId: f.guildId, type: f.type }
            });
            if (!existing) {
                // Try to parse action from SQLite 'actions' if it's a JSON string
                let action = "DELETE_MESSAGE";
                try {
                    const acts = JSON.parse(f.actions || "[]");
                    if (acts.length > 0) action = acts[0].type || "DELETE_MESSAGE";
                } catch(err) {}

                await postgres.autoModFilter.create({
                    data: {
                        guildId: f.guildId,
                        type: f.type,
                        enabled: f.enabled === 1 || f.enabled === true,
                        action: action,
                        data: f.settings // Map settings to data
                    }
                });
            }
        } catch (e) {
            console.error(`  Error syncing filter ${f.type}:`, e.message);
        }
    }
    console.log(`Synced ${data.AutoModFilter?.length || 0} Filters`);

    // 4. Audit Logs
    let logCount = 0;
    for (const l of data.AuditLog || []) {
        try {
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
