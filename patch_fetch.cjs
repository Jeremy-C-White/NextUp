const fs = require('fs');
let code = fs.readFileSync('src/lib/tmdb.ts', 'utf8');

code = code.replace(
  /async function fetchTMDB\(endpoint: string, params: Record<string, string> = \{\}\) \{/g,
  `async function fetchTMDB(endpoint: string, params: Record<string, string> = {}, signal?: AbortSignal) {`
);

code = code.replace(
  /const res = await fetch\(url\.toString\(\)\);/g,
  `const res = await fetch(url.toString(), { signal });`
);

code = code.replace(
  /await fetchTMDB\('\/search\/multi', \{ query, include_adult: 'false' \}\);/g,
  `await fetchTMDB('/search/multi', { query, include_adult: 'false' }, signal);`
);

fs.writeFileSync('src/lib/tmdb.ts', code);
