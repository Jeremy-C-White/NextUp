const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const \[trendingShows, setTrendingShows\] = useState<Show\[\]>\(\[\]\);/g,
  `const [trendingShows, setTrendingShows] = useState<Show[]>([]);\n  const [trendingMovies, setTrendingMovies] = useState<Show[]>([]);`
);

code = code.replace(
  /getTrendingTMDB\(\)\.then\(setTrendingShows\)\.catch\(console\.error\);/g,
  `getTrendingTMDB().then(setTrendingShows).catch(console.error);\n    getTrendingMoviesTMDB().then(setTrendingMovies).catch(console.error);`
);

// We should also add it to the Discover section UI
code = code.replace(
  /\{ id: 'trending', title: 'New and trending', subtitle: 'Series drawing attention this week.', shows: trendingShows \},/g,
  `{ id: 'trending', title: 'New and trending', subtitle: 'Series drawing attention this week.', shows: trendingShows },
                  { id: 'trending-movies', title: 'Trending Movies', subtitle: 'Popular movies this week.', shows: trendingMovies },`
);

fs.writeFileSync('src/App.tsx', code);
