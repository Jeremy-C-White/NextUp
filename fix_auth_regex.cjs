const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/try {\s+await signInWithEmailAndPassword.*?throw err;\s+}/s, 'await signInWithEmailAndPassword(auth, loginEmail, password);');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
