const fs = require('fs');
let code = fs.readFileSync('src/lib/tvmaze.ts', 'utf8');

code = code.replace(
  'function setCached<T>(key: string, data: T, ttlMinutes = 60) {\n  localStorage.setItem(key, JSON.stringify({\n    data,\n    expiry: Date.now() + ttlMinutes * 60 * 1000\n  }));\n}',
  `function setCached<T>(key: string, data: T, ttlMinutes = 60) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000
    }));
  } catch (e) {
    console.warn('Cache write failed (quota exceeded?)', e);
  }
}`
);

// Cache searchShows
const searchOriginal = `export async function searchShows(query: string, signal?: AbortSignal): Promise<Show[]> {
  const res = await fetch(\`\${BASE_URL}/search/shows?q=\${encodeURIComponent(query)}\`, { signal });
  if (!res.ok) throw new Error("Failed to search shows");
  const data = await res.json();
  return data.map((item: any) => item.show);
}`;

const searchNew = `export async function searchShows(query: string, signal?: AbortSignal): Promise<Show[]> {
  const cacheKey = \`tvmaze_search_\${query}\`;
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  const res = await fetch(\`\${BASE_URL}/search/shows?q=\${encodeURIComponent(query)}\`, { signal });
  if (!res.ok) throw new Error("Failed to search shows");
  const data = await res.json();
  const shows = data.map((item: any) => item.show);
  setCached(cacheKey, shows, 360); // 6 hours
  return shows;
}`;

code = code.replace(searchOriginal, searchNew);

// Fix exponential backoff comment
code = code.replace('// Exponential backoff', '// Linear backoff');

fs.writeFileSync('src/lib/tvmaze.ts', code);
