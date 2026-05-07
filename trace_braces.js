const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') depth++;
        if (line[j] === '}') depth--;
    }
    if (depth < 0) {
        console.log(`Error: Negative brace depth at line ${i + 1}: ${depth}`);
        // Reset depth or break?
    }
}
console.log(`Final brace depth: ${depth}`);
