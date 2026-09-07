const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const line649 = lines.findIndex((l, i) => i > 640 && l.includes('const eps = episodesMap[show.id] || playbackRequest.contextEpisodes || [];'));
if (line649 !== -1) {
  lines[line649] = '      const eps = episodesMap[show.id] || [];';
}

const line818 = lines.findIndex((l, i) => i > 800 && l.includes('const eps = episodesMap[show.id] || [];'));
if (line818 !== -1) {
  lines[line818] = '      const eps = episodesMap[show.id] || playbackRequest.contextEpisodes || [];';
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log('Fixed');
