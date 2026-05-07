const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

const s = content.indexOf('return (');
let o = 0, cl = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') o++;
        if (line[j] === '}') cl++;
    }
    if (cl > o) {
        console.log(`Error: Balance negative at line ${i + 1}: Open=${o}, Close=${cl}`);
        console.log(`Line ${i + 1}: ${line}`);
        // Reset or stop? Let's just keep going to see if it recovers.
    }
}
console.log(`Final: Open=${o}, Close=${cl}`);
