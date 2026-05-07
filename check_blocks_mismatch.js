const fs = require('fs');
const content = fs.readFileSync('clean_tabs.txt', 'utf8');
const blocks = content.split(/\{activeTab ===/);

blocks.forEach((b, idx) => {
    if (idx === 0) return;
    const stack = [];
    let i = 0;
    while (i < b.length) {
        if (b[i] === '<') {
            const rest = b.substring(i);
            const match = rest.match(/^<(\/?[a-zA-Z][a-zA-Z0-9\.]*)/);
            if (match) {
                const fullTag = match[1];
                const end = b.indexOf('>', i);
                const isSelfClosing = b[end - 1] === '/';
                if (fullTag.startsWith('/')) {
                    const name = fullTag.substring(1);
                    if (stack.length > 0) {
                        const last = stack.pop();
                        if (last.name !== name) {
                            // console.log(`Block ${idx} Mismatch: ${name} exp ${last.name}`);
                            stack.push(last);
                        }
                    }
                } else {
                    if (!isSelfClosing && !['input', 'img', 'br', 'hr', 'meta', 'link', 'textarea'].includes(fullTag)) {
                        stack.push({ name: fullTag });
                    }
                }
                i = end + 1;
            } else i++;
        } else i++;
    }
    if (stack.length > 0) {
        console.log(`Block ${idx} (${content.match(new RegExp("{activeTab === '([a-zA-Z]+)'"))[1]}) Unclosed:`, stack.map(s => s.name));
    }
});
