const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function seed() {
    const result = await p.devUser.upsert({
        where: { userId: '903646482610126848' },
        update: {},
        create: { userId: '903646482610126848' }
    });
    console.log('Seeded dev:', result);
    await p.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
