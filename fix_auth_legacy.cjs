const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const target = `          if ((err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") && password.length < 6) { 
             // Try legacy format 
             await signInWithEmailAndPassword(auth, loginEmail, \`\${password}-nextup\`); 
             await signOut(auth); // Sign out immediately so we stay on AuthScreen 
             setLegacyEmail(loginEmail); 
             setLegacyPassword(\`\${password}-nextup\`); 
             setNeedsMigration(true); 
             setLoading(false); 
             return;
          }`;

code = code.replace(target, '');
fs.writeFileSync('src/components/AuthScreen.tsx', code);
