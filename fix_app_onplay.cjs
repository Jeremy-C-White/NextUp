const fs = require('fs');
let types = fs.readFileSync('src/types.ts', 'utf8').split('\n');

let appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const handlePlayIndex = appLines.findIndex(l => l.includes('const handlePlayEpisode = (showId: string, imdbId: string | undefined, episode: UserEpisode'));
if (handlePlayIndex !== -1) {
  appLines[handlePlayIndex] = '  const handlePlayEpisode = (showId: string, imdbId: string | undefined, episode: UserEpisode, contextEpisodes?: UserEpisode[]) => {';
  const setRequestIndex = appLines.findIndex((l, i) => i > handlePlayIndex && l.includes('episodeName: episode.name,'));
  if (setRequestIndex !== -1) {
    appLines.splice(setRequestIndex + 1, 0, '      contextEpisodes,');
  }
  fs.writeFileSync('src/App.tsx', appLines.join('\n'));
  console.log('App.tsx handlePlayEpisode patched');
}

let detailsLines = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8').split('\n');
const onPlayProp = detailsLines.findIndex(l => l.includes('onPlayEpisode?: (showId: string, imdbId: string | undefined, episode: UserEpisode'));
if (onPlayProp !== -1) {
  detailsLines[onPlayProp] = '  onPlayEpisode?: (showId: string, imdbId: string | undefined, episode: UserEpisode, contextEpisodes?: UserEpisode[]) => void;';
}
const handlePlayMod = detailsLines.findIndex(l => l.includes('onPlayEpisode(show.id, finalImdbId || show.imdbId, ep)'));
if (handlePlayMod !== -1) {
  detailsLines[handlePlayMod] = '        onPlayEpisode(show.id, finalImdbId || show.imdbId, ep, displayEpisodes);';
}
fs.writeFileSync('src/components/DetailsModal.tsx', detailsLines.join('\n'));
console.log('DetailsModal.tsx patched');
