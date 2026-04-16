import { Client, ClientOptions, Collection, EmbedBuilder, REST, Routes } from 'discord.js';
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
    public db: ServerData = new ServerData();
    public utils: Utils = new Utils();
    public lavalink: LavalinkClient;
    public rest: REST = new REST({ version: "10" }).setToken(process.env.TOKEN || "");
    
    public config = config;
    public readonly emoji = config.emoji;
    public readonly color = config.color;

    public xpCooldowns: Map<string, number> = new Map();
    public invites: Map<string, Collection<string, number>> = new Map();
    public captchaCodes: Map<string, string> = new Map();
    public embedDrafts: Map<string, any> = new Map();

    constructor(options: ClientOptions) {
        super(options);

        this.lavalink = new LavalinkClient(this);

        // Register event listeners for Lavalink
        this.registerLavalinkEvents();
    }

    public embed(): EmbedBuilder {
        return new EmbedBuilder();
    }

    public async start(): Promise<void> {
        await initI18n();
        
        try {
            await this.login(process.env.TOKEN);
            logger.info(`Logged in as ${this.user?.tag}`);
        } catch (error) {
            logger.error("Critical error during startup:", error);
            process.exit(1);
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
        this.lavalink.on('trackException', (player: any, track: any, exception: any) => {
            logger.error(`[Lavalink] Track exception in guild ${player.guildId}:`, exception.message);
        });
    }
}