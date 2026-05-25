import { z } from "zod";
import * as dotenv from 'dotenv';

dotenv.config();

const LavalinkNodeSchema = z.object({
	id: z.string(),
	host: z.string(),
	port: z.number(),
	authorization: z.string(),
	secure: z.preprocess(
		(val) => (val === "true" || val === "false" ? val === "true" : val),
		z.boolean().optional(),
	),
	sessionId: z.string().optional(),
	regions: z.string().array().optional(),
	retryAmount: z.number().optional(),
	retryDelay: z.number().optional(),
	requestSignalTimeoutMS: z.number().optional(),
	closeOnError: z.boolean().optional(),
	heartBeatInterval: z.number().optional(),
	enablePingOnStatsCheck: z.boolean().optional(),
});

const envSchema = z.object({
	TOKEN: z.string(),
	CLIENT_ID: z.string(),
	DEFAULT_LANGUAGE: z.string().default("en-US"),
	PREFIX: z.string().default("!"),
	OWNER_IDS: z.preprocess(
		(val) => (typeof val === "string" ? JSON.parse(val) : val),
		z.string().array().optional(),
	),
	GUILD_ID: z.string().optional(),
	TOPGG: z.string().optional(),
	KEEP_ALIVE: z.preprocess((val) => val === "true", z.boolean().default(false)),
	LOG_CHANNEL_ID: z.string().optional(),
	LOG_COMMANDS_ID: z.string().optional(),
	BOT_STATUS: z.preprocess(
		(val) => {
			if (typeof val === "string") {
				return val.toLowerCase();
			}
			return val;
		},
		z.enum(["online", "idle", "dnd", "invisible"]).default("online"),
	),
	BOT_ACTIVITY: z.string().default("Lavamusic"),
	BOT_ACTIVITY_TYPE: z.preprocess((val) => {
		if (typeof val === "string") {
			return Number.parseInt(val, 10);
		}
		return val;
	}, z.number().default(0)),
	STREAMING_URL: z.string().default("https://twitch.tv/discord"),
	DATABASE_URL: z.string().optional(),
	SEARCH_ENGINE: z.preprocess(
		(val) => {
			if (typeof val === "string") {
				return val.toLowerCase() as any;
			}
			return val;
		},
		z
			.enum([
				"youtube",
				"youtubemusic",
				"soundcloud",
				"spotify",
				"apple",
				"deezer",
				"yandex",
				"jiosaavn",
			])
			.default("youtube"),
	),
	NODES: z.preprocess(
		(val) => (typeof val === "string" ? JSON.parse(val) : val),
		z.array(LavalinkNodeSchema),
	),
	GENIUS_API: z.string().optional(),
	GIPHY_API_KEY: z.string().optional(),
	MISTRAL_API_KEY: z.string().optional(),
	KLIPY_API_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
