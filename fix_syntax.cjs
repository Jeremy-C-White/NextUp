const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '{pct < 100 && eps.length > 0 && (\n                    \n                  )}',
  ''
);
fs.writeFileSync('src/App.tsx', codeApp);
