const fs = require('fs');
const content = fs.readFileSync('clean_tabs.txt', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = (line.match(/<div/g) || []).length;
    const close = (line.match(/<\/div>/g) || []).length;
    depth += open;
    depth -= close;
    if (depth < 0) {
        console.log(`Error: Negative div depth at line ${i + 1}`);
        depth = 0;
    }
}
console.log(`Final div depth: ${depth}`);
