const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/  const \[needsMigration, setNeedsMigration\] = useState\(false\);\n/, '');
code = code.replace(/  const \[newPin, setNewPin\] = useState\(""\);\n/, '');
code = code.replace(/  const \[legacyEmail, setLegacyEmail\] = useState\(""\);\n/, '');
code = code.replace(/  const \[legacyPassword, setLegacyPassword\] = useState\(""\);\n/, '');

const migrationBlock = `    if (needsMigration) {
      if (newPin.length < 6) {
        setError("New PIN must be at least 6 digits");
        setLoading(false);
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, legacyEmail, legacyPassword);
        const user = auth.currentUser;
        if (user) {
          await updatePassword(user, newPin);
          // Migration complete, user is now logged in with new PIN
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    
`;
code = code.replace(migrationBlock, '');

const legacyCatch = `          if ((err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") && password.length < 6) { 
             // Just show the migration screen
             setLegacyEmail(loginEmail); 
             setLegacyPassword(\`\${password}-nextup\`); 
             setNeedsMigration(true); 
             setLoading(false); 
             return;
          }`;
code = code.replace(legacyCatch, '');

code = code.replace(/{needsMigration && \([\s\S]*?Action required:[\s\S]*?<\/div>\s*\)\s*}/, '');
code = code.replace(/{!needsMigration && !isLogin && \(/g, '{!isLogin && (');
code = code.replace(/{!needsMigration && \(/g, '{true && (');
code = code.replace(/needsMigration \? "Upgrade PIN" : /g, '');
code = code.replace(/setNeedsMigration\(false\); /g, '');

fs.writeFileSync('src/components/AuthScreen.tsx', code);
