const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="relative h-48 bg-slate-950 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"',
  'className="relative h-48 bg-slate-950 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation"'
);

fs.writeFileSync('src/App.tsx', code);
