const fs = require('fs');

let codeOnb = fs.readFileSync('src/components/OnboardingScreen.tsx', 'utf8');
codeOnb = codeOnb.replace(
  '<div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pb-[env(safe-area-inset-bottom)] pt-12">',
  '<div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pb-[calc(1rem+env(safe-area-inset-bottom))] pt-12">'
);
fs.writeFileSync('src/components/OnboardingScreen.tsx', codeOnb);
