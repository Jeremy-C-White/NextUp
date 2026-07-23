const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const oldTry = `      if (isLogin) {
        try {
          await signInWithEmailAndPassword(auth, loginEmail, password);
        } catch (err: any) {
          if ((err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") && password.length < 6) { 
             // Try legacy format 
             await signInWithEmailAndPassword(auth, loginEmail, \`\${password}-nextup\`); 
             await signOut(auth); // Sign out immediately so we stay on AuthScreen 
             setLegacyEmail(loginEmail); 
             setLegacyPassword(\`\${password}-nextup\`); 
             setNeedsMigration(true); 
             setLoading(false); 
             return;
          }
          throw err;
        }
      } else {`;

const newTry = `      if (isLogin) {
        await signInWithEmailAndPassword(auth, loginEmail, password);
      } else {`;

code = code.replace(oldTry, newTry);
fs.writeFileSync('src/components/AuthScreen.tsx', code);
