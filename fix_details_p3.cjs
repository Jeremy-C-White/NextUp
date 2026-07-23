const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  'className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors"',
  'className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors active:scale-95 touch-manipulation"'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
