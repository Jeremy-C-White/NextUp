const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/onChange=\{\(e\) => setName\(e\.target\.value\}/g, 'onChange={(e) => setName(e.target.value)}');
code = code.replace(/onChange=\{\(e\) => setEmail\(e\.target\.value\}/g, 'onChange={(e) => setEmail(e.target.value)}');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
