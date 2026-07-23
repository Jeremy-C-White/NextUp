const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {`;

const replace = `  useEffect(() => {
    if (user && localStorage.getItem('nextup_needs_onboarding') === 'true') {
      setIsOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {`;

code = code.replace(target, replace);
fs.writeFileSync('src/App.tsx', code);
