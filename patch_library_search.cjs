const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const filterRegex = /if \(libraryFilter !== "all"\) \{[\s\S]*?\}\n\s*lib\.sort\(/;

const replacement = `if (libraryFilter !== "all") {
      lib = lib.filter(show => {
        const eps = episodesMap[show.id] || [];
        const unwatched = eps.filter(e => !e.watched && (e.airstamp ? isPast(new Date(e.airstamp)) : true));
        const caughtUp = unwatched.length === 0;
        
        if (libraryFilter === "watching") return !caughtUp;
        if (libraryFilter === "caught-up") return caughtUp && show.status !== "Ended";
        if (libraryFilter === "ended") return show.status === "Ended";
        return true;
      });
    }

    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      lib = lib.filter(s => s.name.toLowerCase().includes(q));
    }

    lib.sort(`;

code = code.replace(filterRegex, replacement);

code = code.replace(
  '}, [shows, episodesMap, libraryFilter, librarySort]);',
  '}, [shows, episodesMap, libraryFilter, librarySort, librarySearch]);'
);

fs.writeFileSync('src/App.tsx', code);
