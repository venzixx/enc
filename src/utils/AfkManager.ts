import { EmbedBuilder, GuildMember, Message } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { ExtendedClient } from '../client';

export interface ServerAfkEntry {
    userId: string;
    guildId: string;
    reason: string;
    timestamp: number;
    mentions: {
        userId: string;
        userTag: string;
        guildId: string;
        channelId: string;
        messageId: string;
        createdAt: number;
    }[];
}

const SERVER_AFK_FILE = path.join(process.cwd(), 'server_afk.json');

class AfkManagerStore {
    private serverAfkMap: Map<string, ServerAfkEntry> = new Map();

    constructor() {
        this.loadServerAfkData();
    }

    private loadServerAfkData() {
        if (fs.existsSync(SERVER_AFK_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(SERVER_AFK_FILE, 'utf-8'));
                if (Array.isArray(data)) {
                    for (const item of data) {
                        if (item.userId && item.guildId) {
                            this.serverAfkMap.set(`${item.guildId}:${item.userId}`, item);
                        }
                    }
                }
            } catch (err) {
                console.error('[AFK] Error loading server_afk.json:', err);
            }
        }
    }

    private saveServerAfkData() {
        try {
            const list = Array.from(this.serverAfkMap.values());
            fs.writeFileSync(SERVER_AFK_FILE, JSON.stringify(list, null, 2));
        } catch (err) {
            console.error('[AFK] Error saving server_afk.json:', err);
        }
    }

    /** Clean up [AFK] nickname prefixes for a user across all guilds or a specific target guild */
    public async cleanupAfkNicknames(client: ExtendedClient, userId: string, targetGuildId?: string) {
        const guildsToCheck = targetGuildId 
            ? [client.guilds.cache.get(targetGuildId)].filter(Boolean)
            : Array.from(client.guilds.cache.values());

        for (const guild of guildsToCheck) {
            if (!guild) continue;
            try {
                const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
                if (member && member.nickname && member.nickname.startsWith('[AFK]')) {
                    const cleanedName = member.nickname.replace(/^\[AFK\]\s*/, '').trim();
                    const shouldReset = cleanedName === member.user.username || cleanedName === member.user.displayName || !cleanedName;
                    await member.setNickname(shouldReset ? null : cleanedName).catch(() => {});
                }
            } catch {}
        }
    }

    /** Set Global AFK */
    public async setGlobalAfk(client: ExtendedClient, userId: string, member: GuildMember | null, reason: string) {
        const existing = await (client.prisma as any).afk.findUnique({
            where: { userId }
        });
        if (existing) {
            return { success: false, existing };
        }

        if (member) {
            const currentNickname = member.nickname;
            const baseName = currentNickname || member.displayName || member.user.username;
            if (!baseName.startsWith('[AFK]')) {
                const afkName = Array.from(`[AFK] ${baseName}`).slice(0, 32).join('');
                await member.setNickname(afkName).catch(() => {});
            }
        }

        const created = await (client.prisma as any).afk.create({
            data: {
                userId,
                reason
            }
        });

        return { success: true, record: created };
    }

    /** Set Server AFK (safk) */
    public async setServerAfk(client: ExtendedClient, userId: string, guildId: string, member: GuildMember | null, reason: string) {
        const key = `${guildId}:${userId}`;
        if (this.serverAfkMap.has(key)) {
            return { success: false, existing: this.serverAfkMap.get(key) };
        }

        if (member) {
            const currentNickname = member.nickname;
            const baseName = currentNickname || member.displayName || member.user.username;
            if (!baseName.startsWith('[AFK]')) {
                const afkName = Array.from(`[AFK] ${baseName}`).slice(0, 32).join('');
                await member.setNickname(afkName).catch(() => {});
            }
        }

        const entry: ServerAfkEntry = {
            userId,
            guildId,
            reason,
            timestamp: Date.now(),
            mentions: []
        };

        this.serverAfkMap.set(key, entry);
        this.saveServerAfkData();
        return { success: true, record: entry };
    }

    /** Get Global AFK */
    public async getGlobalAfk(client: ExtendedClient, userId: string) {
        return await (client.prisma as any).afk.findUnique({
            where: { userId },
            include: { mentions: true }
        });
    }

    /** Get Server AFK */
    public getServerAfk(guildId: string, userId: string): ServerAfkEntry | undefined {
        return this.serverAfkMap.get(`${guildId}:${userId}`);
    }

    /** Remove Global AFK and restore nicknames across ALL servers */
    public async removeGlobalAfk(client: ExtendedClient, userId: string) {
        const existing = await (client.prisma as any).afk.findUnique({
            where: { userId },
            include: { mentions: true }
        });

        if (!existing) return null;

        await (client.prisma as any).afk.delete({ where: { userId } });
        await this.cleanupAfkNicknames(client, userId);
        return existing;
    }

    /** Remove Server AFK and restore nickname in specific guild */
    public async removeServerAfk(client: ExtendedClient, guildId: string, userId: string) {
        const key = `${guildId}:${userId}`;
        const existing = this.serverAfkMap.get(key);
        if (!existing) return null;

        this.serverAfkMap.delete(key);
        this.saveServerAfkData();
        await this.cleanupAfkNicknames(client, userId, guildId);
        return existing;
    }

    /** Add Server AFK mention */
    public addServerAfkMention(guildId: string, afkUserId: string, mentionData: ServerAfkEntry['mentions'][0]) {
        const key = `${guildId}:${afkUserId}`;
        const entry = this.serverAfkMap.get(key);
        if (entry) {
            entry.mentions.push(mentionData);
            this.saveServerAfkData();
        }
    }
}

export const AfkManager = new AfkManagerStore();
