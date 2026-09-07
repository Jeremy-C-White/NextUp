const fs = require('fs');
let appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const onPlayNextIndex = appLines.findIndex(l => l.includes('onPlayNext={req => {'));
if (onPlayNextIndex !== -1) {
  const innerCall = appLines.findIndex((l, i) => i > onPlayNextIndex && l.includes('handlePlayEpisode(req.showId'));
  if (innerCall !== -1) {
    appLines[innerCall] = '            handlePlayEpisode(req.showId, req.imdbId, { season: req.season, number: req.number, name: req.episodeName, id: "", showId: 0, airdate: "", airstamp: "", imageUrl: "", summary: "", watched: false }, playbackRequest.contextEpisodes);';
    fs.writeFileSync('src/App.tsx', appLines.join('\n'));
    console.log('App.tsx onPlayNext patched');
  }
}
