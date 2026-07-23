const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

code = code.replace(
  'export async function addShowToLibrary(show: Show): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {',
  'export async function addShowToLibrary(show: Show, caughtUp: boolean = false): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {'
);

code = code.replace(
  'watchedEpisodes: {}',
  `watchedEpisodes: caughtUp ? episodes.filter(ep => ep.airstamp && new Date(ep.airstamp) < new Date()).reduce((acc, ep) => ({ ...acc, [ep.id.toString()]: Date.now() }), {}) : {}`
);

fs.writeFileSync('src/lib/library.ts', code);
