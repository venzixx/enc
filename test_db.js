const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// Manually add the missing columns
const columns = [
  "logChannelMessages",
  "logChannelChannels", 
  "logChannelRoles",
  "logChannelMembers",
  "logChannelModeration",
  "logChannelSecurity",
  "logChannelVoice"
];

async function main() {
  for (const col of columns) {
    try {
      await p.$executeRawUnsafe(`ALTER TABLE Guild ADD COLUMN "${col}" TEXT`);
      console.log(`Added column: ${col}`);
    } catch (e) {
      if (e.message.includes("duplicate column")) {
        console.log(`Column already exists: ${col}`);
      } else {
        console.log(`Error adding ${col}: ${e.message}`);
      }
    }
  }
  
  // Verify
  const info = await p.$queryRawUnsafe("PRAGMA table_info(Guild)");
  const logCols = info.map(c => c.name).filter(c => c.includes("log") || c.includes("Log"));
  console.log("\nLog columns after fix:", JSON.stringify(logCols));
}

main().finally(() => p.$disconnect());
