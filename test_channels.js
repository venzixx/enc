const DISCORD_API_URL = "https://discord.com/api/v10";
require('dotenv').config({ path: './dashboard/.env' });

async function test() {
  const guildId = "1493521070584500354"; // From logs
  const token = process.env.DISCORD_TOKEN;
  console.log("Using token:", token?.substring(0, 10) + "...");

  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` }
  });

  if (!response.ok) {
    console.error("Error:", response.status, await response.text());
    return;
  }

  const channels = await response.json();
  console.log("Found", channels.length, "channels.");
  channels.filter(c => [0, 5].includes(c.type)).forEach(c => console.log(`- ${c.name} (${c.type})`));
}

test();
