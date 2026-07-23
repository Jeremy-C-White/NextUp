const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  '<div className="flex-1 flex flex-col min-h-0 bg-slate-900/50">',
  '<div className="flex-1 flex flex-col md:min-h-0 bg-slate-900/50">'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
