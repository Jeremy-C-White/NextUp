const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'import { format, isPast, isFuture } from "date-fns";',
  'import { format, isPast, isFuture } from "date-fns";\nimport { registerSW } from "virtual:pwa-register";'
);

fs.writeFileSync('src/App.tsx', code);
