import { GatewayIntentBits, Partials } from 'discord.js';
import { ExtendedClient } from './client';
import { loadCommands, loadEvents, loadComponents } from './handlers/loader';
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
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User,
    ],
});

async function main() {
    await loadCommands(client);
    await loadEvents(client);
    await loadComponents(client);

    await client.start();
}

main().catch(console.error);

export { client };
