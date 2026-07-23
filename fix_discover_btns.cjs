const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/px-3 py-1\.5 bg-slate-800/g, 'px-4 py-2 bg-slate-800 rounded-lg');
code = code.replace(/px-3 py-1\.5 bg-slate-800\/50/g, 'px-4 py-2 bg-slate-800/50 rounded-lg');

fs.writeFileSync('src/App.tsx', code);
