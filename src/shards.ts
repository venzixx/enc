import { ShardingManager } from 'discord.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token: process.env.DISCORD_TOKEN,
    totalShards: 'auto',
});

manager.on('shardCreate', shard => {
    console.log(`[SHARD] Launched shard ${shard.id}`);
});

manager.spawn().catch(err => {
    console.error('[SHARD] Failed to spawn shards:', err);
});
