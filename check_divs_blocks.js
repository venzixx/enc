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
    if (open > 0 || close > 0) {
        // console.log(`${i+1}: Depth ${depth} (O:${open}, C:${close})`);
    }
}

// Check by tab block
const blocks = content.split(/\{activeTab ===/);
blocks.forEach((b, i) => {
    if (i === 0) return;
    const open = (b.match(/<div/g) || []).length;
    const close = (b.match(/<\/div>/g) || []).length;
    console.log(`Block ${i}: Open=${open}, Close=${close}, Balance=${open-close}`);
});
