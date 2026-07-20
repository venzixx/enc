const { PrismaClient } = require('@prisma/client');
const path = require('path');

// We need a temporary prisma client pointing to sqlite
// Actually, I can't easily do that without regenerating the client.

// I'll just use a raw better-sqlite3 if available or just skip this.
// Wait! I can just use my export script again but only for that guild and log it.
