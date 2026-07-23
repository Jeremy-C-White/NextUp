const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/\{\s*true\s*&&\s*\(\s*<div>/g, '<div>');
code = code.replace(/<\/div>\s*\)\}/g, '</div>');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
