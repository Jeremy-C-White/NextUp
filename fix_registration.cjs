const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/const ALLOW_REGISTRATION = .*;\n/, '');
code = code.replace(/{ALLOW_REGISTRATION && \(/, '{true && (');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
