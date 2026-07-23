const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  'const loginEmail = email.includes("@") ? email : \\`\\${email}@nextup.local\\`;',
  'const loginEmail = email.includes("@") ? email : `${email}@nextup.local`;'
);

code = code.replace(
  'className={\\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \\${',
  'className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${'
);

code = code.replace(
  '}\\`}',
  '}`}'
);
code = code.replace(
  'className={\\`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors \\${',
  'className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${'
);

code = code.replace(
  '}\\`}',
  '}`}'
);


fs.writeFileSync('src/components/AuthScreen.tsx', code);
