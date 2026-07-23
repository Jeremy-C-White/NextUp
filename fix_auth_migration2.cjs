const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

if (!code.includes('import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword, signOut } from "firebase/auth";')) {
    code = code.replace(
        'import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword } from "firebase/auth";',
        'import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword, signOut } from "firebase/auth";'
    );
}

const origState = `  const [needsMigration, setNeedsMigration] = useState(false);
  const [newPin, setNewPin] = useState("");`;

const newState = `  const [needsMigration, setNeedsMigration] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [legacyEmail, setLegacyEmail] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");`;

code = code.replace(origState, newState);

const origMigrationTry = `    if (needsMigration) {
      if (newPin.length < 6) {
        setError("New PIN must be at least 6 digits");
        setLoading(false);
        return;
      }
      try {
        const user = auth.currentUser;
        if (user) {
          await updatePassword(user, newPin);
          // Migration complete
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }`;

const newMigrationTry = `    if (needsMigration) {
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
    }`;

code = code.replace(origMigrationTry, newMigrationTry);

const origFallback = `          if ((err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") && password.length < 6) {
             // Try legacy format
             await signInWithEmailAndPassword(auth, loginEmail, \`\${password}-nextup\`);
             setNeedsMigration(true);
             setLoading(false);
             return;
          }`;

const newFallback = `          if ((err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") && password.length < 6) {
             // Try legacy format
             await signInWithEmailAndPassword(auth, loginEmail, \`\${password}-nextup\`);
             await signOut(auth); // Sign out immediately so we stay on AuthScreen
             setLegacyEmail(loginEmail);
             setLegacyPassword(\`\${password}-nextup\`);
             setNeedsMigration(true);
             setLoading(false);
             return;
          }`;

code = code.replace(origFallback, newFallback);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
