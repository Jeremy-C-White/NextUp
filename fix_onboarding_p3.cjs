const fs = require('fs');
let code = fs.readFileSync('src/components/OnboardingScreen.tsx', 'utf8');

code = code.replace(
  '<img src={show.image.medium} alt={show.name} className="w-full aspect-[2/3] object-cover" />',
  '<img decoding="async" loading="lazy" src={show.image.medium} alt={show.name} className="w-full aspect-[2/3] object-cover" />'
);

const oldSearch = `  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchShows(searchQuery)
        .then(setSearchResults)
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);`;

const newSearch = `  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchShows(searchQuery, controller.signal)
        .then(res => {
          if (!controller.signal.aborted) setSearchResults(res);
        })
        .catch(err => {
          if (!controller.signal.aborted) console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);`;

code = code.replace(oldSearch, newSearch);

fs.writeFileSync('src/components/OnboardingScreen.tsx', code);
