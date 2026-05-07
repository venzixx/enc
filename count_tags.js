const fs = require('fs');
const content = fs.readFileSync('dashboard/src/app/dashboard/[guildId]/messages/page.tsx', 'utf8');

const tags = {};
const tagRegex = /<(\/?[a-zA-Z0-9\.]+)/g;
let match;
while ((match = tagRegex.exec(content)) !== null) {
    const name = match[1];
    tags[name] = (tags[name] || 0) + 1;
}

const names = Object.keys(tags).filter(n => !n.startsWith('/')).sort();
names.forEach(n => {
    console.log(`${n}: Open=${tags[n]}, Close=${tags['/' + n] || 0}`);
});
