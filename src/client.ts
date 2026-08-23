import { Client, ClientOptions, Collection, EmbedBuilder, REST, Routes, ActivityType, PresenceStatusData } from 'discord.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { LavalinkClient, Command, Component } from './structures';
import { initI18n } from './structures/I18n';
import { env } from './env';
import config from './config';
import logger from './structures/Logger';
import ServerData from './database/server';
import Utils from './utils/Utils';

export class ExtendedClient extends Client {
    public commands: Collection<string, Command> = new Collection();
    public aliases: Collection<string, string> = new Collection();
    public cooldown: Collection<string, any> = new Collection();
    public components: Collection<string, Component> = new Collection();
    
    public prisma: PrismaClient = new PrismaClient();
    public db: ServerData = new ServerData(this.prisma);
    public utils: Utils = new Utils();
    public lavalink: LavalinkClient;
    public rest: REST = new REST({ version: "10" }).setToken(process.env.TOKEN || "");
    
    public config = config;
    public env = env;
    public readonly emoji = config.emoji;
    public readonly color = config.color;

    public xpCooldowns: Map<string, number> = new Map();
    public invites: Map<string, Collection<string, number>> = new Map();
    public captchaCodes: Map<string, string> = new Map();
    public embedDrafts: Map<string, any> = new Map();
    public voiceSessions: Map<string, number> = new Map(); // key: userId, value: joinTimestamp
    public maintenance: {
        enabled: boolean;
        eta: string | null;
    } = {
        enabled: false,
        eta: null,
    };

    constructor(options: ClientOptions) {
        super(options);

        this.lavalink = new LavalinkClient(this);

        // Register event listeners for Lavalink
        this.registerLavalinkEvents();
    }

    public embed(data?: any, ctx?: any): EmbedBuilder {
        return new EmbedBuilder(data);
    }

    public async start(): Promise<void> {
        await initI18n();
        this.loadMaintenance();
        
        try {
            await this.login(process.env.TOKEN);
            logger.info(`Logged in as ${this.user?.tag}`);
        } catch (error) {
            logger.error("Critical error during startup:", error);
            process.exit(1);
        }
    }

    public loadMaintenance(): void {
        const filePath = path.join(process.cwd(), 'maintenance.json');
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                this.maintenance = data;
            } catch (err) {
                logger.error("Failed to load maintenance state:", err);
            }
        }
    }

    public saveMaintenance(): void {
        const filePath = path.join(process.cwd(), 'maintenance.json');
        try {
            fs.writeFileSync(filePath, JSON.stringify(this.maintenance, null, 2));
        } catch (err) {
            logger.error("Failed to save maintenance state:", err);
        }
    }

    public async updateMaintenancePresence(): Promise<void> {
        if (!this.user) return;

        if (this.maintenance.enabled) {
            const status = this.maintenance.eta ? `Maintenance: ${this.maintenance.eta}` : "Under Maintenance";
            this.user.setPresence({
                activities: [{ name: status, type: ActivityType.Custom }],
                status: 'dnd' as PresenceStatusData
            });
        } else {
            // Restore default presence from env or config
            this.user.setPresence({
                activities: [{ 
                    name: this.env.BOT_ACTIVITY || "Lavamusic", 
                    type: (this.env.BOT_ACTIVITY_TYPE as any) || ActivityType.Listening 
                }],
                status: (this.env.BOT_STATUS as any) || 'online'
            });
        }
    }

    private registerLavalinkEvents() {
        this.lavalink.nodeManager.on('error', (node: any, error: any) =>
            logger.error(`[Lavalink] Node ${node.id} error:`, error?.message || error));
        
        this.lavalink.nodeManager.on('connect', (node: any) => {
            logger.info(`[Lavalink] Node ${node.id} is ready!`);
        });

        this.lavalink.nodeManager.on('disconnect', (node: any, reason: any) =>
            logger.warn(`[Lavalink] Node ${node.id} disconnected. Reason: ${reason}`));

        // Basic error handling for players
        // @ts-ignore
        this.lavalink.on('trackException', async (player: any, track: any, exception: any) => {
            const errorMsg = String(exception?.message || exception?.error || exception || "Unknown Error");
            logger.error(`[Lavalink] Track exception in guild ${player.guildId}: ${track?.info?.title || 'Unknown Track'} ->`, errorMsg);

            // Failover to SoundCloud if YouTube is blocked/restricted or failed
            if (track?.info?.title && (track?.info?.sourceName === "youtube" || !track?.info?.uri?.includes("soundcloud.com"))) {
                logger.info(`[Lavalink] Attempting automatic failover to SoundCloud for: ${track.info.title}`);
                try {
                    const res = await this.lavalink.search({ query: track.info.title, source: "scsearch" }, track.requester);
                    if (res && res.tracks && res.tracks.length > 0) {
                        logger.info(`[Lavalink] Failover found SoundCloud alternative: ${res.tracks[0].info.title}`);
                        await player.queue.add(res.tracks[0], 0);
                        return player.skip();
                    }
                } catch (err) {
                    logger.error(`[Lavalink] Failover search failed:`, err);
                }
            }
        });

        // @ts-ignore
        this.lavalink.on('trackStuck', async (player: any, track: any, payload: any) => {
            logger.warn(`[Lavalink] Track STUCK in guild ${player.guildId}: ${track?.info?.title || 'Unknown Track'} (Threshold: ${payload?.thresholdMs}ms).`);
            
            // Failover to SoundCloud if it seems throttled
            if (track?.info?.sourceName === "youtube") {
                const channel = this.channels.cache.get(player.textChannelId) as any;
                if (channel) channel.send(`${this.emoji.exclamation} Track playback stalled. Attempting to switch to an alternative source...`).catch(() => {});
                
                try {
                    const res = await this.lavalink.search({ query: track.info.title, source: "scsearch" }, track.requester);
                    if (res && res.tracks.length > 0) {
                        player.queue.add(res.tracks[0], 0);
                        return player.skip();
                    }
                } catch (err) {
                    logger.error(`[Lavalink] Failover search failed:`, err);
                }
            }
            player.skip();
        });

        // @ts-ignore
        this.lavalink.on('playerDestroy', (player: any) => {
            logger.info(`[Lavalink] Player DESTROYED in guild ${player.guildId}. Trace: ${new Error().stack}`);
        });

        // @ts-ignore
        this.lavalink.on('playerDisconnect', (player: any) => {
            logger.info(`[Lavalink] Player DISCONNECTED in guild ${player.guildId}.`);
        });

        // @ts-ignore
        this.lavalink.nodeManager.on('raw', (node: any, payload: any) => {
            if (payload?.op === 'event') {
                logger.info(`[Lavalink-RAW] EVENT: ${payload.type} for guild ${payload.guildId} | Reason/Error: ${payload.reason || payload.exception?.message || 'N/A'}`);
            }
        });
    }
}