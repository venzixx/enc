const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

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
                    if (last.name !== name) {
                        const line = content.substring(0, i).split('\n').length;
                        const lastLine = content.substring(0, last.pos).split('\n').length;
                        console.log(`Mismatch at line ${line}: got </${name}>, expected </${last.name}> (opened at line ${lastLine})`);
                        stack.push(last);
                    }
                }
            } else {
                if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link', 'textarea'].includes(fullTag)) {
                    stack.push({ name: fullTag, pos: i });
                }
            }
            i = end + 1;
        } else i++;
    } else i++;
}
