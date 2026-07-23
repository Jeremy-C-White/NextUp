const fs = require('fs');
let code = fs.readFileSync('src/components/OnboardingScreen.tsx', 'utf8');

code = code.replace(
  'className="flex-1 overflow-y-auto pb-24 grid grid-cols-2',
  'className="flex-1 overflow-y-auto pb-48 grid grid-cols-2'
);

fs.writeFileSync('src/components/OnboardingScreen.tsx', code);
