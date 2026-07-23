const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /const unwatched = eps\.filter\(e => !e\.watched && isEpisodeReleased\(e, now\)\);/g,
  `const unwatched = getReleasedEpisodes(eps, false).filter(e => !e.watched);`
);

fs.writeFileSync('src/App.tsx', updated);
