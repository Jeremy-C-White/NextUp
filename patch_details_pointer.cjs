const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  'className="absolute inset-0 w-full h-full object-cover opacity-30"',
  'className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"'
);

code = code.replace(
  'className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"',
  'className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none"'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
