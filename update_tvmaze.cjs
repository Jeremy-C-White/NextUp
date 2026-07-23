const fs = require('fs');
let content = fs.readFileSync('src/lib/tvmaze.ts', 'utf8');

content = content.replace(
  'export async function searchShows(query: string): Promise<Show[]> {',
  'export async function searchShows(query: string, signal?: AbortSignal): Promise<Show[]> {'
);
content = content.replace(
  'const res = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(query)}`);',
  'const res = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(query)}`, { signal });'
);

fs.writeFileSync('src/lib/tvmaze.ts', content);
