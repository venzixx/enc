const fs = require('fs');
const content = fs.readFileSync('clean_tabs.txt', 'utf8');

// We'll process the whole thing as one string
let fixed = '';
const stack = [];
let i = 0;
while (i < content.length) {
    if (content[i] === '<') {
        const rest = content.substring(i);
        const match = rest.match(/^<(\/?[a-zA-Z][a-zA-Z0-9\.]*)/);
        if (match) {
            const fullTag = match[1];
            const end = content.indexOf('>', i);
            const isSelfClosing = content[end - 1] === '/';
            
            if (fullTag.startsWith('/')) {
                const name = fullTag.substring(1);
                if (stack.length > 0) {
                    const last = stack.pop();
                    if (last.name === name) {
                        fixed += content.substring(i, end + 1);
                    } else {
                        console.log(`Fixing mismatch: got </${name}>, expected </${last.name}>. Dropping </${name}>.`);
                        // Push last back and SKIP this closing tag
                        stack.push(last);
                    }
                } else {
                    console.log(`Fixing extra close: dropping </${name}>`);
                }
            } else {
                const name = fullTag;
                fixed += content.substring(i, end + 1);
                if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link', 'textarea'].includes(name)) {
                    stack.push({ name, pos: fixed.length - (end - i + 1) });
                }
            }
            i = end + 1;
        } else {
            fixed += content[i];
            i++;
        }
    } else {
        fixed += content[i];
        i++;
    }
}

// Close remaining tags in reverse order
while (stack.length > 0) {
    const last = stack.pop();
    console.log(`Fixing unclosed: adding </${last.name}>`);
    fixed += `</${last.name}>`;
}

fs.writeFileSync('clean_tabs_perfect.txt', fixed);
console.log('Perfectly balanced clean_tabs.txt saved.');
