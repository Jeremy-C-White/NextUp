const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const origDiscoverEffect = `  useEffect(() => {
    if (activeTab === "discover" && trendingShows.length === 0) {
      fetchDiscover();
    }
  }, [activeTab]);`;

const newDiscoverEffect = `  useEffect(() => {
    if (activeTab === "discover" && (trendingShows.length === 0 || (forYou.length === 0 && shows.length > 0))) {
      fetchDiscover();
    }
  }, [activeTab, shows.length]);`;

code = code.replace(origDiscoverEffect, newDiscoverEffect);
fs.writeFileSync('src/App.tsx', code);
