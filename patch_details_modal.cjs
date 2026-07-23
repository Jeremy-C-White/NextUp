const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  /const streamUrl = await getBestTorrentioStream\(show\.imdbId, episode\.season, episode\.number\);/g,
  `const isMovie = (show as any)._isMovie || (show as any).isMovie;
      const streamUrl = await getBestTorrentioStream(show.imdbId, episode.season, episode.number, isMovie ? 'movie' : 'series');`
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
