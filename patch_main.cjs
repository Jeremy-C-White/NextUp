const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace("import { registerSW } from 'virtual:pwa-register';\n\nregisterSW({ immediate: true });", "");
fs.writeFileSync('src/main.tsx', code);
