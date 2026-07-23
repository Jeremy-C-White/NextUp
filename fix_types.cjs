const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(
  '  genres?: string[];',
  '  genres?: string[];\n  rating?: { average?: number };\n  vote_average?: number;'
);
fs.writeFileSync('src/types.ts', code);
