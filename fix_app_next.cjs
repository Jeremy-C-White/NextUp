const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('const show = shows.find(s => s.id === playbackRequest.showId);'));

if (startIndex !== -1) {
  lines.splice(startIndex, 2, 
    '    const show = shows.find(s => s.id === playbackRequest.showId) || (selectedShow?.id === playbackRequest.showId ? selectedShow : undefined);',
    '    if (show) {',
    '      const eps = episodesMap[show.id] || (selectedShow?.id === show.id ? selectedShowEpisodes : []);'
  );
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log('App.tsx patched');
} else {
  console.log('Could not find target line');
}
