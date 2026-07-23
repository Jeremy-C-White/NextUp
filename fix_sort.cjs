const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  'const seasons = Array.from(new Set(displayEpisodes.map(e => Number(e.season)))).sort((a, b) => b - a);',
  'const seasons = Array.from(new Set(displayEpisodes.map(e => Number(e.season)))).sort((a: any, b: any) => b - a);'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
