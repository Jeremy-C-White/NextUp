const fs = require('fs');
const code = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

const updated = code.replace(
  /const inLibrary = library\.some\(s => s\.tvmazeId === show\.id\);/g,
  `const inLibrary = library.some(s => {
    if (s.imdbId && show.externals?.imdb && s.imdbId === show.externals.imdb) return true;
    if (s.isMovie === show.isMovie && s._tmdbId && show._tmdbId && s._tmdbId === show._tmdbId) return true;
    if (s.tvmazeId && show.id > 0 && s.tvmazeId === show.id) return true;
    if (s.name.toLowerCase() === show.name.toLowerCase() && (s.premiered?.split('-')[0] === show.premiered?.split('-')[0])) return true;
    return false;
  });`
);

fs.writeFileSync('src/components/SearchModal.tsx', updated);
