const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
if (!code.includes('virtual:pwa-register')) {
  code = code.replace(
    "import './index.css';",
    "import './index.css';\nimport { registerSW } from 'virtual:pwa-register';\n\nregisterSW({ immediate: true });"
  );
  fs.writeFileSync('src/main.tsx', code);
}
