const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
const current = fs.readFileSync(path, 'utf8');
const lines = current.split('\n');

if (lines[591].trim() === lines[592].trim()) {
    lines.splice(591, 1);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Removed duplicate line at 592.');
} else {
    console.log('No duplicate line found at 592 (trimmed).');
}
