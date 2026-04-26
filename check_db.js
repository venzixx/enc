const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const info = await prisma.$queryRawUnsafe(`PRAGMA table_info(Guild)`);
    info.forEach(col => console.log(col.name));
  } catch (e) {
    console.error(e);
  }
  await prisma.$disconnect();
}

check();
