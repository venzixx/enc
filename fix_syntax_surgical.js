const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the end of the selectMenus mapping
const endSelectMenus = content.lastIndexOf('                                     ))}');
if (endSelectMenus === -1) {
    console.error('Could not find end of selectMenus');
    process.exit(1);
}

// Find the start of Assets tab
const startAssets = content.indexOf("{activeTab === 'Assets' && (");
if (startAssets === -1) {
    console.error('Could not find start of Assets tab');
    process.exit(1);
}

// Construct the clean version
// We need to close the Select Menus section, then the Interactive tab div, then the Interactive tab block.
const midCode = '\n                                  </div>\n                               </div>\n                            )}\n\n                            ';

const newContent = content.substring(0, endSelectMenus + '                                     ))}'.length) + midCode + content.substring(startAssets);

fs.writeFileSync(path, newContent);
console.log('Fixed syntax error surgically.');
