const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('Settings,')) {
    code = code.replace('import { Tv, Search, LogOut', 'import { Tv, Search, LogOut, Settings');
}

code = code.replace(
    '<span className="text-xl leading-none">⚙️</span>',
    '<Settings className="w-5 h-5" />'
);

fs.writeFileSync('src/App.tsx', code);
