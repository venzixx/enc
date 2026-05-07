const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

const stack = [];
let i = 0;
while (i < content.length) {
    if (content[i] === '<') {
        if (content[i+1] === '!' || content.substring(i, i+4) === '<!--') {
            // Skip comments
            i = content.indexOf('-->', i) + 3;
            continue;
        }
        if (content[i+1] === '/') {
            // Closing tag
            const end = content.indexOf('>', i);
            const name = content.substring(i + 2, end).trim().split(' ')[0];
            if (stack.length === 0) {
                console.log(`Error: Extra closing tag </${name}> at pos ${i}`);
            } else {
                const last = stack.pop();
                if (last.name !== name) {
                    console.log(`Error: Mismatched tag </${name}> at pos ${i}, expected </${last.name}> (opened at pos ${last.pos})`);
                    stack.push(last);
                }
            }
            i = end + 1;
        } else {
            // Opening tag
            const end = content.indexOf('>', i);
            if (end === -1) break;
            const isSelfClosing = content[end - 1] === '/';
            const tagContent = content.substring(i + 1, end).trim();
            const name = tagContent.split(/[ \n\t\r\/>]/)[0];
            
            if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link'].includes(name)) {
                stack.push({ name, pos: i });
            }
            i = end + 1;
        }
    } else {
        i++;
    }
}

console.log('Unclosed tags at end:');
stack.reverse().forEach(s => {
    // Find line number
    const line = content.substring(0, s.pos).split('\n').length;
    console.log(`${s.name} (line ${line})`);
});
