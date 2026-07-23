const fs = require('fs');
let code = fs.readFileSync('src/lib/tmdb.ts', 'utf8');

code = code.replace(
  '      thetvdb: externals.tvdb_id\n    },',
  '      thetvdb: externals.tvdb_id\n    },\n    vote_average: tmdbShow.vote_average,'
);

fs.writeFileSync('src/lib/tmdb.ts', code);
