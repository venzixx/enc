const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const columnsToAdd = [
    // Logging Channels
    ['Guild', 'logChannelMessages', 'TEXT'],
    ['Guild', 'logChannelChannels', 'TEXT'],
    ['Guild', 'logChannelRoles', 'TEXT'],
    ['Guild', 'logChannelMembers', 'TEXT'],
    ['Guild', 'logChannelModeration', 'TEXT'],
    ['Guild', 'logChannelSecurity', 'TEXT'],
    ['Guild', 'logChannelVoice', 'TEXT'],
    
    // Ticket Formatting
    ['TicketConfig', 'ticketNameFormat', 'TEXT DEFAULT "ticket-{id}"'],
    ['TicketConfig', 'ticketCount', 'INTEGER DEFAULT 0'],

    // Leveling System
    ['Guild', 'levelingEnabled', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'xpFormulaCurve', 'TEXT DEFAULT "LINEAR"'],
    ['Guild', 'xpFormulaMultiplier', 'REAL DEFAULT 1.0'],
    ['Guild', 'xpFormulaMaxLevel', 'INTEGER'],
    ['Guild', 'xpMessageEnabled', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'xpMessageMode', 'TEXT DEFAULT "RANDOM"'],
    ['Guild', 'xpMessageMin', 'INTEGER DEFAULT 15'],
    ['Guild', 'xpMessageMax', 'INTEGER DEFAULT 25'],
    ['Guild', 'xpMessageCooldown', 'INTEGER DEFAULT 60'],
    ['Guild', 'xpVoiceEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'xpVoiceMin', 'INTEGER DEFAULT 15'],
    ['Guild', 'xpVoiceMax', 'INTEGER DEFAULT 40'],
    ['Guild', 'xpVoiceCooldown', 'INTEGER DEFAULT 180'],
    ['Guild', 'xpVoiceMinMembers', 'INTEGER DEFAULT 2'],
    ['Guild', 'xpVoiceAntiAfk', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'xpReactionEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'xpReactionAwardType', 'TEXT DEFAULT "BOTH"'],
    ['Guild', 'xpReactionMin', 'INTEGER DEFAULT 5'],
    ['Guild', 'xpReactionMax', 'INTEGER DEFAULT 10'],
    ['Guild', 'xpReactionCooldown', 'INTEGER DEFAULT 300'],
    ['Guild', 'levelUpMessageEnabled', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'levelUpMessage', 'TEXT DEFAULT "GG {user.mention}, you just reached level **{user.level}**!"'],
    ['Guild', 'levelUpImageEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'firstPlaceRoleId', 'TEXT'],
    ['Guild', 'stackRoleRewards', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'stackXpBoosters', 'BOOLEAN DEFAULT 1'],
    ['Guild', 'voteRewardEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'effortBoosterEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'effortBoosterWords', 'INTEGER DEFAULT 25'],
    ['Guild', 'effortBoosterImages', 'INTEGER DEFAULT 3'],
    ['Guild', 'effortBoosterPercentage', 'INTEGER DEFAULT 10'],
    ['Guild', 'weeklyHighlightsEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'weeklyHighlightsChannelId', 'TEXT'],
    ['Guild', 'monthlyHighlightsEnabled', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'monthlyHighlightsChannelId', 'TEXT'],
    ['Guild', 'rankCardProgressColor', 'TEXT DEFAULT "#ffffff"'],
    ['Guild', 'rankCardProgressOpacity', 'REAL DEFAULT 1.0'],
    ['Guild', 'rankCardBackgroundColor', 'TEXT DEFAULT "#000000"'],
    ['Guild', 'rankCardFontColor', 'TEXT DEFAULT "#ffffff"'],
    ['Guild', 'rankCardBackgroundUrl', 'TEXT'],
    ['Guild', 'disableXpCommand', 'BOOLEAN DEFAULT 0'],
    ['Guild', 'disableLeaderboardReset', 'BOOLEAN DEFAULT 0']
  ];

  // Create tables using raw SQL
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS RoleBooster (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      roleId TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      FOREIGN KEY (guildId) REFERENCES Guild(id) ON DELETE CASCADE
    )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS RoleBooster_guildId_roleId_key ON RoleBooster(guildId, roleId)`);
    console.log("Verified RoleBooster table.");
  } catch (e) { console.error("Error creating RoleBooster table:", e.message); }

  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ChannelBooster (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      FOREIGN KEY (guildId) REFERENCES Guild(id) ON DELETE CASCADE
    )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS ChannelBooster_guildId_channelId_key ON ChannelBooster(guildId, channelId)`);
    console.log("Verified ChannelBooster table.");
  } catch (e) { console.error("Error creating ChannelBooster table:", e.message); }

  // Add columns
  for (const [table, col, type] of columnsToAdd) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}`);
      console.log(`Added column ${col} to ${table}.`);
    } catch (err) {
      if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
        // console.log(`Column ${col} already exists in ${table}.`);
      } else {
        console.error(`Error adding ${col} to ${table}:`, err.message);
      }
    }
  }

  await prisma.$disconnect();
}

fix();
