const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const target = `        const cred = await createUserWithEmailAndPassword(auth, loginEmail, password);
        await updateProfile(cred.user, { displayName: name || email });`;

const replacement = `        const cred = await createUserWithEmailAndPassword(auth, loginEmail, password);
        await updateProfile(cred.user, { displayName: name || email });
        localStorage.setItem('nextup_needs_onboarding', 'true');`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
