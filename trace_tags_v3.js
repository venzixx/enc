const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

const stack = [];
let i = 0;
while (i < content.length) {
    if (content[i] === '<') {
        // Skip comments
        if (content.substring(i, i+4) === '<!--') {
            i = content.indexOf('-->', i) + 3;
            continue;
        }
        
        // Potential tag
        const rest = content.substring(i);
        // Match actual tags: <div, <motion.div, </div, etc.
        // Avoid matching < alone (less than operator)
        const match = rest.match(/^<(\/?[a-zA-Z][a-zA-Z0-9\.]*)/);
        if (match) {
            const fullTag = match[1];
            const end = content.indexOf('>', i);
            if (end === -1) break;
            const isSelfClosing = content[end - 1] === '/';
            
            if (fullTag.startsWith('/')) {
                const name = fullTag.substring(1);
                if (stack.length === 0) {
                    console.log(`Error: Extra closing tag </${name}> at pos ${i}`);
                } else {
                    const last = stack.pop();
                    if (last.name !== name) {
                        console.log(`Error: Mismatched tag </${name}> at pos ${i}, expected </${last.name}> (opened at pos ${last.pos})`);
                        // Try to find the correct opening tag in stack
                        // for now just push back
                        stack.push(last);
                    }
                }
            } else {
                const name = fullTag;
                if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link', 'textarea'].includes(name)) {
                    stack.push({ name, pos: i });
                }
            }
            i = end + 1;
        } else {
            i++;
        }
    } else {
        i++;
    }
}

console.log('Unclosed tags at end:');
stack.reverse().forEach(s => {
    const line = content.substring(0, s.pos).split('\n').length;
    console.log(`${s.name} (line ${line})`);
});
