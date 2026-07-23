const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// For "On the horizon"
codeApp = codeApp.replace(
  'className="w-full flex gap-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 items-center text-left',
  'className="w-full flex gap-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 items-start text-left'
);

// For "Airing Tonight"
codeApp = codeApp.replace(
  'className="w-full flex gap-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 items-center text-left',
  'className="w-full flex gap-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 items-start text-left'
);

fs.writeFileSync('src/App.tsx', codeApp);
