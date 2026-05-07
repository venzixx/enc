const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// The error is around 1106-1163.
// Let's find the first "Interactive" tab closing brace.
// Line 1104 is the end of selectMenus mapping.
// Line 1105 is the closing div of selectMenus section.
// Line 1106 is the closing div of Interactive tab.
// But it has extra text.

const startFix = 1105; // 1-indexed
const endFix = 1163; // 1-indexed

const newLines = [
    ...lines.slice(0, startFix),
    '                                 </div>',
    '                              </div>',
    '                           )}',
    ...lines.slice(endFix)
];

fs.writeFileSync(path, newLines.join('\n'));
console.log('Fixed syntax error.');
