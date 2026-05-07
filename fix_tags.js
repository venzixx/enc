const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Insert closing tags after the tabs container (which ends at the div closing 592)
// In the current file, line 972 is that div.
// Note: 0-indexed, so line 972 is lines[971].
// We want to insert after lines[971].

lines.splice(972, 0, '               </motion.section>', '            </div>');

fs.writeFileSync(path, lines.join('\n'));
console.log('Inserted missing closing tags at 973-974.');
