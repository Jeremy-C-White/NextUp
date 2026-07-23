const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const target = `    try {
      const credential = EmailAuthProvider.credential(user.email, currentPin);
      await reauthenticateWithCredential(user, credential);`;

const replacement = `    try {
      try {
        const credential = EmailAuthProvider.credential(user.email, currentPin);
        await reauthenticateWithCredential(user, credential);
      } catch (err: any) {
        if ((err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') && currentPin.length < 6) {
          const credential = EmailAuthProvider.credential(user.email, currentPin + '-nextup');
          await reauthenticateWithCredential(user, credential);
        } else {
          throw err;
        }
      }`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/SettingsModal.tsx', code);
