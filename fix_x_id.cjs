const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'localStorage.setItem(\'nextup_dismissed_recs\', JSON.stringify([...dismissed, show._tmdbId]));',
  'localStorage.setItem(\'nextup_dismissed_recs\', JSON.stringify([...dismissed, show.id]));'
);

fs.writeFileSync('src/App.tsx', code);
