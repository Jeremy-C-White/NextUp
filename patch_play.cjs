const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const streamUrl = await getBestTorrentioStream\(imdbId, episode\.season, episode\.number\);/g,
  `const show = shows.find(s => s.id === showId);
      const isMovie = show?.isMovie || (show as any)?._isMovie;
      const streamUrl = await getBestTorrentioStream(imdbId, episode.season, episode.number, isMovie ? 'movie' : 'series');`
);

fs.writeFileSync('src/App.tsx', code);
