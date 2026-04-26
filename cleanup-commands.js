const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}. Starting command purge...`);
    
    try {
        const guilds = await client.guilds.fetch();
        console.log(`Found ${guilds.size} guilds.`);
        
        for (const [id, guild] of guilds) {
            try {
                await client.application.commands.set([], id);
                console.log(`✅ Cleared guild commands for: ${id}`);
            } catch (err) {
                console.error(`❌ Failed to clear for guild ${id}:`, err.message);
            }
        }
        
        console.log("\nPurge complete! Only global commands should remain (or reappear shortly).");
        process.exit(0);
    } catch (err) {
        console.error("Fatal error during purge:", err);
        process.exit(1);
    }
});

client.login(process.env.TOKEN);
