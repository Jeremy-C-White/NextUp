const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const showIndex = lines.findIndex(l => l.includes('const show = shows.find(s => s.id === playbackRequest.showId) || (selectedShow?.id === playbackRequest.showId ? selectedShow : undefined);'));

if (showIndex !== -1) {
  lines.splice(showIndex, 4, 
    '    const show = shows.find(s => s.id === playbackRequest.showId) || (detailsShow?.id === playbackRequest.showId ? detailsShow : undefined);',
    '    if (show) {',
    '      const eps = episodesMap[show.id] || [];'
  );
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log('App.tsx detailsShow patched');
} else {
  console.log('Could not find target line');
}
