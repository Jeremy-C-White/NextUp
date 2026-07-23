const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  /resolveTVMazeShow\(\{ id: show\.tvmazeId, name: show\.name, externals: \{ imdb: show\.imdbId \} \} as any\)\n\s*\.then\(resolved => getEpisodes\(resolved\.id\)\)/g,
  `Promise.resolve((show as any)._isMovie || (show as any).isMovie ? [{id: "movie_"+show.id, season: 1, number: 1, name: "Movie", airstamp: new Date().toISOString()}] : resolveTVMazeShow({ id: show.tvmazeId, name: show.name, externals: { imdb: show.imdbId } } as any).then(resolved => getEpisodes(resolved.id)))`
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
