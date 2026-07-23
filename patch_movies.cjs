const fs = require('fs');
let code = fs.readFileSync('src/lib/tmdb.ts', 'utf8');

const getTrendingMoviesStr = `
export async function getTrendingMoviesTMDB(): Promise<Show[]> {
  const cacheKey = 'tmdb_trending_movies';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchTMDB('/trending/movie/day');
  const shows = await Promise.all(data.results.slice(0, 10).map(enrichTMDBMovie));
  setCached(cacheKey, shows);
  return shows;
}
`;

code = code.replace(
  /export async function getTrendingTMDB/g,
  getTrendingMoviesStr + '\nexport async function getTrendingTMDB'
);

// We also need to export enrichTMDBMovie so it can be called if needed, but it is already used in searchMultiTMDB and now getTrendingMoviesTMDB. Wait, enrichTMDBMovie needs to be hoisted or accessible if it isn't. Let's make sure it exists at the bottom.

fs.writeFileSync('src/lib/tmdb.ts', code);
