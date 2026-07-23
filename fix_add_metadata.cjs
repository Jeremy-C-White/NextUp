const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

code = code.replace(
  'imdbId: show.externals?.imdb || "",',
  'imdbId: show.externals?.imdb || "",\n    genres: show.genres || [],\n    runtime: show.runtime || 0,\n    officialSite: show.officialSite || "",\n    backdropUrl: show.image?.original || "",'
);

fs.writeFileSync('src/lib/library.ts', code);
