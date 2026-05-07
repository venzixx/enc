const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');
const lines = content.split('\n');

const stack = [];
const tagRegex = /<(\/?[a-zA-Z0-9\.]+)/g;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const fullTag = match[1];
        if (fullTag.startsWith('/')) {
            const name = fullTag.substring(1);
            if (stack.length === 0) {
                console.log(`Error: Extra closing tag </${name}> at line ${i + 1}`);
            } else {
                const last = stack.pop();
                if (last.name !== name) {
                    console.log(`Error: Mismatched tag </${name}> at line ${i + 1}, expected </${last.name}> (opened at line ${last.line})`);
                    // Push it back to keep going
                    stack.push(last);
                }
            }
        } else {
            // Check for self-closing
            const rest = line.substring(match.index + match[0].length);
            if (rest.trim().startsWith('/>') || (match[0].includes('input') || match[0].includes('img') || match[0].includes('br') || match[0].includes('textarea'))) {
                // Ignore self-closing or known self-closing in this simplified checker
            } else {
                stack.push({ name: fullTag, line: i + 1 });
            }
        }
    }
}

console.log('Unclosed tags at end:');
stack.reverse().forEach(s => console.log(`${s.name} (line ${s.line})`));
