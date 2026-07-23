const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regexes = [
  {
    search: /className="w-16 h-24 shrink-0 bg-slate-900 rounded-xl overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"/g,
    replace: 'className="w-16 h-24 shrink-0 bg-slate-900 rounded-xl overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation"'
  },
  {
    search: /className="absolute inset-0 z-10"/g,
    replace: 'className="absolute inset-0 z-10 touch-manipulation"'
  },
  {
    search: /className="w-full h-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"/g,
    replace: 'className="w-full h-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation"'
  }
];

regexes.forEach(({search, replace}) => {
  code = code.replace(search, replace);
});

fs.writeFileSync('src/App.tsx', code);
