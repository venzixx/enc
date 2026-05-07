const fs = require('fs');
const content = fs.readFileSync('clean_tabs.txt', 'utf8');

const parts = content.split(/(\{activeTab === '[a-zA-Z]+' && \()/);
let fixed = parts[0];

for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i];
    let block = parts[i+1];
    
    // Process block to find mismatches and balance
    const stack = [];
    let bIdx = 0;
    let fixedBlock = '';
    
    while (bIdx < block.length) {
        if (block[bIdx] === '<') {
            const rest = block.substring(bIdx);
            const match = rest.match(/^<(\/?[a-zA-Z][a-zA-Z0-9\.]*)/);
            if (match) {
                const fullTag = match[1];
                const end = block.indexOf('>', bIdx);
                const isSelfClosing = block[end - 1] === '/';
                
                if (fullTag.startsWith('/')) {
                    const name = fullTag.substring(1);
                    if (stack.length > 0) {
                        const last = stack.pop();
                        if (last === name) {
                            fixedBlock += block.substring(bIdx, end + 1);
                        } else {
                            console.log(`Fixing block ${header}: got </${name}>, expected </${last}>. Dropping </${name}>.`);
                            stack.push(last);
                        }
                    } else {
                        console.log(`Fixing block ${header}: extra close </${name}>. Dropping.`);
                    }
                } else {
                    const name = fullTag;
                    fixedBlock += block.substring(bIdx, end + 1);
                    if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link', 'textarea'].includes(name)) {
                        stack.push(name);
                    }
                }
                bIdx = end + 1;
            } else {
                fixedBlock += block[bIdx];
                bIdx++;
            }
        } else {
            fixedBlock += block[bIdx];
            bIdx++;
        }
    }
    
    // Close remaining tags before )}
    const lastParen = fixedBlock.lastIndexOf(')}');
    if (lastParen !== -1) {
        let closing = '';
        while (stack.length > 0) {
            const name = stack.pop();
            console.log(`Fixing block ${header}: adding </${name}>`);
            closing += `</${name}>`;
        }
        fixedBlock = fixedBlock.substring(0, lastParen) + closing + fixedBlock.substring(lastParen);
    }
    
    fixed += header + fixedBlock;
}

fs.writeFileSync('clean_tabs_balanced.txt', fixed);
console.log('Block-balanced clean_tabs.txt saved.');
