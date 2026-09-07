const fs = require('fs');
let lines = fs.readFileSync('src/types.ts', 'utf8').split('\n');

const reqIndex = lines.findIndex(l => l.includes('  episodeName: string;'));
if (reqIndex !== -1) {
  lines.splice(reqIndex + 1, 0, '  contextEpisodes?: UserEpisode[];');
  fs.writeFileSync('src/types.ts', lines.join('\n'));
  console.log('types.ts patched');
} else {
  console.log('Could not find types.ts line');
}

let appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const epsIndex = appLines.findIndex(l => l.includes('const eps = episodesMap[show.id] || [];'));
if (epsIndex !== -1) {
  appLines[epsIndex] = '      const eps = episodesMap[show.id] || playbackRequest.contextEpisodes || [];';
  fs.writeFileSync('src/App.tsx', appLines.join('\n'));
  console.log('App.tsx contextEpisodes patched');
}
