const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app/prisma/dev.db.bak');

db.all("SELECT * FROM AuditLog LIMIT 1", (err, rows) => {
    if (err) console.error(err);
    else console.log("Sample AuditLog from BAK:", rows);
});

db.all("SELECT COUNT(*) as count FROM AuditLog", (err, rows) => {
    if (err) console.error(err);
    else console.log("Total AuditLogs in BAK:", rows[0].count);
});

db.close();
