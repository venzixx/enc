import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { ExtendedClient } from '../client';
import logger from '../structures/Logger';
import { V2Helper } from './V2Helper';

export interface StoredTimer {
    id: string; // Message ID or unique timer ID
    channelId: string;
    guildId: string | null;
    authorId: string;
    authorTag: string;
    startTime: number; // Unix ms
    endTime: number;   // Unix ms
    durationStr: string;
    reason: string;
}

export class TimerManager {
    private static dbPath = path.join(process.cwd(), 'timers.json');
    private static timers: Map<string, StoredTimer> = new Map();
    private static interval: NodeJS.Timeout | null = null;
    private static ticking = false;
    private static retryAfter = new Map<string, number>();
    private static client: ExtendedClient | null = null;

    /**
     * Read timers from disk
     */
    private static loadTimers(): void {
        try {
            if (!fs.existsSync(this.dbPath)) {
                this.timers = new Map();
                return;
            }
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            const parsed: StoredTimer[] = JSON.parse(data);
            this.timers = new Map();
            if (Array.isArray(parsed)) {
                for (const t of parsed) {
                    this.timers.set(t.id, t);
                }
            }
        } catch (err) {
            logger.error('[TimerManager] Error reading timers.json:', err);
            this.timers = new Map();
        }
    }

    /**
     * Save timers to disk atomically
     */
    private static saveTimers(): void {
        try {
            const list = Array.from(this.timers.values());
            const tempPath = `${this.dbPath}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf-8');
            fs.renameSync(tempPath, this.dbPath);
        } catch (err) {
            logger.error('[TimerManager] Error saving timers.json:', err);
        }
    }

    /**
     * Initialize TimerManager background ticker
     */
    public static init(client: ExtendedClient): void {
        this.client = client;
        this.loadTimers();

        if (this.interval) clearInterval(this.interval);

        // Run ticker every 3 seconds for precise completion
        this.interval = setInterval(async () => {
            await this.tick();
        }, 3000);

        logger.info(`[TimerManager] Initialized with ${this.timers.size} active timers.`);

        // Run immediately on boot to handle timers that completed while bot was restarting
        this.tick().catch(err => {
            logger.error('[TimerManager] Initial tick error:', err);
        });
    }

    /**
     * Add a new timer
     */
    public static addTimer(timer: StoredTimer): void {
        this.timers.set(timer.id, timer);
        this.saveTimers();
    }

    /**
     * Remove / cancel a timer
     */
    public static removeTimer(id: string): StoredTimer | null {
        const timer = this.timers.get(id);
        if (timer) {
            this.timers.delete(id);
            this.retryAfter.delete(id);
            this.saveTimers();
            return timer;
        }
        return null;
    }

    /**
     * Get active timers in a guild or DM
     */
    public static getGuildTimers(guildId: string | null): StoredTimer[] {
        return Array.from(this.timers.values()).filter(t => t.guildId === guildId);
    }

    /**
     * Get timer by ID
     */
    public static getTimer(id: string): StoredTimer | undefined {
        return this.timers.get(id);
    }

    /**
     * Ticker that checks for expired timers
     */
    private static async tick(): Promise<void> {
        if (!this.client || this.ticking) return;
        this.ticking = true;
        try {
            for (const timer of this.timers.values()) {
                if (Date.now() < Math.max(timer.endTime, this.retryAfter.get(timer.id) ?? 0)) continue;
                const sent = await this.completeTimer(timer);
                if (this.timers.get(timer.id) !== timer) continue;
                if (sent) this.removeTimer(timer.id);
                else this.retryAfter.set(timer.id, Date.now() + 60_000);
            }
        } finally {
            this.ticking = false;
        }
    }

    /**
     * Complete and notify a timer
     */
    private static async completeTimer(timer: StoredTimer): Promise<boolean> {
        if (!this.client) return false;

        try {
            const channel = await this.client.channels.fetch(timer.channelId).catch(() => null);

            // 1. Edit original countdown message if accessible to stop relative timestamp from counting into past
            if (channel && channel.isTextBased() && timer.id) {
                try {
                    const originalMsg = await (channel as any).messages.fetch(timer.id).catch(() => null);
                    if (originalMsg) {
                        const endedLayout = V2Helper.createLayout({
                            title: '⏱️ Timer Completed',
                            description: `✅ Your **${timer.durationStr}** timer has ended!${timer.reason ? `\n> **Reason:** ${timer.reason}` : ''}`,
                            color: this.client.color.green || 0x22c55e,
                            borderless: true
                        });
                        await originalMsg.edit(endedLayout as any).catch(() => {});
                    }
                } catch {}
            }

            const notification = { ...V2Helper.createLayout({
                description: `🔔 <@${timer.authorId}>, your **${timer.durationStr}** timer has ended!${timer.reason ? `\n> **Reason:** ${timer.reason}` : ''}`,
                borderless: true,
                allowedMentions: { parse: [], users: [timer.authorId], roles: [] }
            }), nonce: createHash('sha256').update(`timer:${timer.id}`).digest('hex').slice(0, 24), enforceNonce: true };
            if (channel?.isSendable()) {
                const sent = await channel.send(notification).catch(error => {
                    logger.error(`[TimerManager] Could not notify in channel for timer ${timer.id}:`, error);
                    return null;
                });
                if (sent) return true;
            }

            const user = await this.client.users.fetch(timer.authorId).catch(() => null);
            if (user) {
                await user.send(notification);
                return true;
            }
        } catch (err) {
            logger.error(`[TimerManager] Error completing timer ${timer.id}:`, err);
        }
        return false;
    }
}
