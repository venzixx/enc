const fs = require('fs');
const { execSync } = require('child_process');

const dbFiles = [
    'app/prisma/dev.db',
    'app/prisma/dev.db.bak',
    'app/prisma/dev.db.new_bak',
    'app/prisma/inspect_old.db',
    'app/prisma/latest_inspect.db',
    'app/dashboard/prisma/dev.db'
];

dbFiles.forEach(file => {
    try {
        // Use sqlite3 command line tool if available
        const count = execSync(`sqlite3 ${file} "SELECT COUNT(*) FROM AuditLog"`).toString().trim();
        console.log(`${file}: AuditLog count = ${count}`);
        const memberCount = execSync(`sqlite3 ${file} "SELECT COUNT(*) FROM Member"`).toString().trim();
        console.log(`${file}: Member count = ${memberCount}`);
    } catch (e) {
        console.log(`${file}: Error or no table AuditLog/Member`);
    }
});
