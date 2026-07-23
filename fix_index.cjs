const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');
code = code.replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="/icon-192.png">');
code = code.replace('<link rel="manifest" href="/manifest.json">', '');
fs.writeFileSync('index.html', code);
