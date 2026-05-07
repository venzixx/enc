const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

const stack = [];
const startOfJSX = content.indexOf('return (');
const tagRegex = /<(\/?[a-zA-Z0-9\.]+)([^>]*?)(\/?)>/g;
tagRegex.lastIndex = startOfJSX;

let match;
let inString = false;
let stringChar = '';

// Very simple string skipper (not perfect but better)
const skipStrings = (str) => {
    let out = '';
    let isStr = false;
    let sChar = '';
    for(let i=0; i<str.length; i++) {
        if (!isStr && (str[i] === "'" || str[i] === '"' || str[i] === '`')) {
            isStr = true;
            sChar = str[i];
            out += 'S';
        } else if (isStr && str[i] === sChar && str[i-1] !== '\\') {
            isStr = false;
            out += 'E';
        } else if (!isStr) {
            out += str[i];
        } else {
            out += 'X';
        }
    }
    return out;
};

const cleanContent = skipStrings(content);

while ((match = tagRegex.exec(cleanContent)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = tagName.startsWith('/');
    const isSelfClosing = match[3] === '/' || ['input', 'img', 'br', 'hr', 'link', 'meta'].includes(tagName.toLowerCase());

    if (isSelfClosing && !isClosing) continue;
    
    // Ignore generics (Capitalized and no space after <)
    if (!isClosing && tagName[0] !== tagName[0].toUpperCase() && !tagName.includes('.')) {
        if (!['div', 'main', 'section', 'button', 'input', 'textarea', 'label', 'span', 'h1', 'h2', 'h3', 'p', 'select', 'option', 'svg', 'path', 'motion.div', 'motion.section', 'motion.button'].includes(tagName.toLowerCase())) {
            continue;
        }
    }

    if (isClosing) {
        const name = tagName.substring(1);
        if (stack.length === 0) {
             console.log(`Error: Closing tag <${tagName}> with no opening tag at offset ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.name !== name) {
                console.log(`Error: Mismatched closing tag <${tagName}> at offset ${match.index}, expected </${last.name}> (opened at offset ${last.index})`);
                console.log('Open Context:', content.substring(last.index, last.index + 100).replace(/\n/g, ' '));
                console.log('Close Context:', content.substring(match.index, match.index + 100).replace(/\n/g, ' '));
            }
        }
    } else {
        stack.push({ name: tagName, index: match.index });
    }
}

console.log('Unclosed tags at end:');
stack.forEach(t => {
    console.log(`  <${t.name}> at offset ${t.index} : ${content.substring(t.index, t.index+50).replace(/\n/g, ' ')}`);
});
