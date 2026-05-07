const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';

const original = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const lines = original.split('\n');

const prefix = lines.slice(0, 591);
// Fix the missing div for line 575
prefix.push('                  </div>');

const cleanTabs = fs.readFileSync('clean_tabs_balanced.txt', 'utf8').replace(/\r\n/g, '\n').split('\n');

const suffixStart = lines.findIndex(l => l.includes('SIDEBAR: ARCHIVES'));
let suffix = lines.slice(suffixStart);

// Fix AnimatePresence in suffix
const saveModalIdx = suffix.findIndex(l => l.includes('saveModalOpen && ('));
if (saveModalIdx !== -1) {
    if (!suffix[saveModalIdx-1].includes('AnimatePresence')) {
        suffix.splice(saveModalIdx, 0, '      <AnimatePresence>');
    }
}

const wrapperClosing = [
    '                        </motion.div>',
    '                     </AnimatePresence>',
    '                  </div>'
];

const closingCol1 = [
    '               </motion.section>',
    '            </div>'
];

const finalLines = [
    ...prefix,
    ...cleanTabs,
    ...wrapperClosing,
    ...closingCol1,
    '',
    ...suffix
];

fs.writeFileSync(path, finalLines.join('\n'));
console.log('Final final final final clean stitch complete.');
