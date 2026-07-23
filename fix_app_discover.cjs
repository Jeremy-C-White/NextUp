const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
code = code.replace(
  'import { getTrendingShows, getPremieringSoon, getHiddenGems, getForYou } from "./lib/tvmaze";',
  'import { getTrendingShows, getPremieringSoon, getHiddenGems, getForYou, resolveTVMazeShow } from "./lib/tvmaze";\nimport { getTrendingTMDB, getRecommendationsTMDB, getTMDBIdFromIMDB } from "./lib/tmdb";'
);

// Update fetchDiscover
const origFetchDiscover = `  const fetchDiscover = () => {
    getTrendingShows().then(setTrendingShows).catch(console.error);
    getPremieringSoon().then(setPremieringSoon).catch(console.error);
    getHiddenGems().then(setHiddenGems).catch(console.error);
    getForYou().then(setForYou).catch(console.error);
  };`;

const newFetchDiscover = `  const fetchDiscover = async () => {
    getTrendingTMDB().then(setTrendingShows).catch(console.error);
    getPremieringSoon().then(setPremieringSoon).catch(console.error);
    getHiddenGems().then(setHiddenGems).catch(console.error);
    
    // ForYou requires fetching TMDB IDs for recent shows
    try {
      const recentImdbs = shows
        .slice(-5)
        .map(s => s.imdbId)
        .filter(Boolean) as string[];
      
      const tmdbIds = (await Promise.all(recentImdbs.map(getTMDBIdFromIMDB))).filter(Boolean) as number[];
      if (tmdbIds.length > 0) {
        getRecommendationsTMDB(tmdbIds).then(setForYou).catch(console.error);
      } else {
        getForYou().then(setForYou).catch(console.error);
      }
    } catch (e) {
      console.error(e);
      getForYou().then(setForYou).catch(console.error);
    }
  };`;

code = code.replace(origFetchDiscover, newFetchDiscover);

// Update handleAddShow to resolve TMDB shows
const origHandleAddShow = `  const handleAddShow = (show: Show, caughtUp: boolean = false) => {
    setIsSearchOpen(false);
    setAppError(null);
    addShowToLibrary(show, caughtUp).catch(err => {
      console.error(err);
      setAppError("Add Show Error: " + err.message);
    });
  };`;

const newHandleAddShow = `  const handleAddShow = (show: Show, caughtUp: boolean = false) => {
    setIsSearchOpen(false);
    setAppError(null);
    
    resolveTVMazeShow(show)
      .then(resolvedShow => addShowToLibrary(resolvedShow, caughtUp))
      .catch(err => {
        console.error(err);
        setAppError("Add Show Error: " + err.message);
      });
  };`;

code = code.replace(origHandleAddShow, newHandleAddShow);

fs.writeFileSync('src/App.tsx', code);
