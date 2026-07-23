const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const origHandleAdd = `  const handleAddShow = async (show: Show, caughtUp: boolean = false) => {
    try {
      setAppError(null);
      const { userShow, userEpisodes } = await addShowToLibrary(show, caughtUp);
      setShows(prev => [...prev, userShow]);
      setEpisodesMap(prev => ({ ...prev, [userShow.id]: userEpisodes }));
      setIsSearchOpen(false);
    } catch (err: any) {
      console.error(err);
      setAppError("Add Show Error: " + err.message);
    }
  };`;

const newHandleAdd = `  const handleAddShow = (show: Show, caughtUp: boolean = false) => {
    setIsSearchOpen(false);
    setAppError(null);
    addShowToLibrary(show, caughtUp).catch(err => {
      console.error(err);
      setAppError("Add Show Error: " + err.message);
    });
  };`;

code = code.replace(origHandleAdd, newHandleAdd);
fs.writeFileSync('src/App.tsx', code);
