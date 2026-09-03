import { GatewayIntentBits, Partials } from 'discord.js';
import { ExtendedClient } from './client';
import { loadCommands, loadEvents, loadComponents } from './handlers/loader';
import { MermaidRenderer } from './utils/MermaidRenderer';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new ExtendedClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.Channel,
    ],
    allowedMentions: {
        parse: [],
        users: [],
        roles: [],
        repliedUser: false
    }
});

async function main() {
    await loadCommands(client);
    await loadEvents(client);
    await loadComponents(client);

    await client.start();
}

main().catch(console.error);

async function shutdown() {
    console.log('Shutting down gracefully...');
    try {
        await MermaidRenderer.cleanup();
    } catch (err) {
        console.error('Error during MermaidRenderer cleanup:', err);
    }
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { client };
