const fs = require('fs');
const path = 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const icons = [
  'Plus', 'Trash2', 'Code', 'Type', 'Palette', 'Layout', 'Sparkles', 
  'Hash', 'Send', 'FileText', 'Eye', 'Copy', 'Download', 'User',
  'MessageSquare', 'Settings', 'Info', 'Calendar', 'Clock', 'Smile', 
  'ExternalLink', 'MousePointer2', 'ListFilter', 'ShieldCheck', 
  'ChevronRight', 'Activity', 'Check', 'Terminal', 'ArrowDown', 'Zap', 'X'
];

const importRegex = /import \{[\s\S]*?\} from 'lucide-react';/;
const newImport = `import { ${icons.join(', ')} } from 'lucide-react';`;

content = content.replace(importRegex, newImport);
fs.writeFileSync(path, content);
console.log('Icons updated successfully.');
