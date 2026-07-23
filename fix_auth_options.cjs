const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

// Always allow registration
code = code.replace(
  'const ALLOW_REGISTRATION = (import.meta as any).env.VITE_ALLOW_REGISTRATION === "true";',
  'const ALLOW_REGISTRATION = true;'
);

// Remove maxLength from PIN inputs to avoid "not taking my pin" issues
code = code.replace(/maxLength=\{6\}/g, '');
code = code.replace(/maxLength=\{needsMigration \? 6 : undefined\}/g, '');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
