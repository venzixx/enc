const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';

// 1. Read the parts
const original = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const lines = original.split('\n');

const prefix = lines.slice(0, 591);
const cleanTabs = fs.readFileSync('clean_tabs_fixed.txt', 'utf8').replace(/\r\n/g, '\n').split('\n');

// Find the sidebar start
const suffixStart = lines.findIndex(l => l.includes('SIDEBAR: ARCHIVES'));
let suffix = lines.slice(suffixStart);

// 2. Fix the AnimatePresence in suffix
// We need to find {saveModalOpen && ( and add <AnimatePresence> before it
const saveModalIdx = suffix.findIndex(l => l.includes('saveModalOpen && ('));
if (saveModalIdx !== -1) {
    suffix.splice(saveModalIdx, 0, '      <AnimatePresence>');
}

// 3. Assemble
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
console.log('Final final clean stitch complete.');
