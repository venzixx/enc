const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
process.exit(0);
