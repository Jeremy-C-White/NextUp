const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "import('./lib/library').then(m => m.markEpisodesWatchedBatch(detailsShow.tvmazeId, epIds, true)).catch(console.error);",
  "markEpisodesWatchedBatch(detailsShow.tvmazeId, epIds, true).catch(console.error);"
);

content = content.replace(
  "import('./lib/library').then(m => m.removeShowFromLibrary(detailsShow.tvmazeId)).catch(console.error);",
  "removeShowFromLibrary(detailsShow.tvmazeId).catch(console.error);"
);

// add markEpisodesWatchedBatch and removeShowFromLibrary to the static import
content = content.replace(
  'import { getLibraryShows, addShowToLibrary, getShowEpisodes, markEpisodeWatched } from "./lib/library";',
  'import { getLibraryShows, addShowToLibrary, getShowEpisodes, markEpisodeWatched, markEpisodesWatchedBatch, removeShowFromLibrary } from "./lib/library";'
);

fs.writeFileSync('src/App.tsx', content);
