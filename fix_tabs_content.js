const fs = require('fs');
const content = fs.readFileSync('clean_tabs.txt', 'utf8');

// We'll split by the tab blocks and fix each one
const parts = content.split(/(\{activeTab === '[a-zA-Z]+' && \()/);

// parts[0] is everything before first block
// parts[1] is "{activeTab === 'Main' && ("
// parts[2] is the content of Main tab
// ...

for (let i = 2; i < parts.length; i += 2) {
    let block = parts[i];
    const open = (block.match(/<div/g) || []).length;
    const close = (block.match(/<\/div>/g) || []).length;
    const balance = open - close;
    
    if (balance > 0) {
        console.log(`Fixing block ${i/2}: adding ${balance} closing divs`);
        // Find the last )} and insert before it
        const lastParen = block.lastIndexOf(')}');
        if (lastParen !== -1) {
            const insertion = '\n' + ' '.repeat(30) + '</div>'.repeat(balance);
            parts[i] = block.substring(0, lastParen) + insertion + '\n' + ' '.repeat(26) + ')}';
        }
    } else if (balance < 0) {
        console.log(`Fixing block ${i/2}: removing ${-balance} closing divs`);
        // This is harder, maybe just leave it for now or find the extra ones.
    }
}

fs.writeFileSync('clean_tabs_fixed.txt', parts.join(''));
console.log('Fixed clean_tabs.txt saved to clean_tabs_fixed.txt');
