const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.autoReact.deleteMany().then(d => {
    console.log("Cleared:", d.count);
}).finally(() => p.$disconnect());
