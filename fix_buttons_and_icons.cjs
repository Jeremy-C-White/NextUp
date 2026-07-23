const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
    'className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 text-orange-950 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-400 hover:scale-105 transition-all z-40"',
    'className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 text-orange-950 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-400 hover:scale-105 active:scale-95 touch-manipulation transition-all z-40"'
);

fs.writeFileSync('src/App.tsx', code);
