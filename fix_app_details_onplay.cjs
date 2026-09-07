const fs = require('fs');
let lines = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8').split('\n');

const handlePlayIndex = lines.findIndex(l => l.includes('onPlayEpisode(show.id, resolvedLocalImdb || show.imdbId, episode);'));

if (handlePlayIndex !== -1) {
  lines[handlePlayIndex] = '      onPlayEpisode(show.id, resolvedLocalImdb || show.imdbId, episode, displayEpisodes);';
  fs.writeFileSync('src/components/DetailsModal.tsx', lines.join('\n'));
  console.log('DetailsModal.tsx handlePlayEpisode patched');
} else {
  console.log('Could not find DetailsModal line');
}
