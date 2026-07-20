const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app/prisma/dev.db');

db.all("SELECT COUNT(*) as count FROM AntiNukeConfig", (err, rows) => {
    if (err) console.error(err);
    else console.log("AntiNukeConfig count:", rows[0].count);
});

db.all("SELECT COUNT(*) as count FROM AutoModFilter", (err, rows) => {
    if (err) console.error(err);
    else console.log("AutoModFilter count:", rows[0].count);
});

db.close();
