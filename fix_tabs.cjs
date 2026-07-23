const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(\) => setIsLogin\(true\)\}/g,
  'onClick={() => { setIsLogin(true); setNeedsMigration(false); setError(""); }}'
);

code = code.replace(
  /onClick=\{\(\) => setIsLogin\(false\)\}/g,
  'onClick={() => { setIsLogin(false); setNeedsMigration(false); setError(""); }}'
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
