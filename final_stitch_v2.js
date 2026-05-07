const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
const original = fs.readFileSync(path, 'utf8');
// Normalize all line endings to \n first
const content = original.replace(/\r\n/g, '\n');
const lines = content.split('\n');

// We need to re-extract the parts from the original-original if possible
// or just fix the current ones.
// Current file is already stitched but has issues.

// I'll try to find the start and end of the corrupted part again.
const prefixEnd = lines.findIndex(l => l.includes('TABS.map')) + 13; // Roughly around line 591
const suffixStart = lines.findIndex(l => l.includes('SIDEBAR: ARCHIVES'));

console.log('Prefix End:', prefixEnd);
console.log('Suffix Start:', suffixStart);

const prefix = lines.slice(0, 591); // Up to the empty line before content
const cleanTabs = fs.readFileSync('clean_tabs.txt', 'utf8').replace(/\r\n/g, '\n').split('\n');
const suffix = lines.slice(suffixStart);

// Closing tags for the editor column (Col 1)
const closingCol1 = [
    '               </motion.section>',
    '            </div>'
];

const finalLines = [
    ...prefix,
    ...cleanTabs,
    ...closingCol1,
    '',
    ...suffix
];

fs.writeFileSync(path, finalLines.join('\n'));
console.log('Final clean stitch complete.');
