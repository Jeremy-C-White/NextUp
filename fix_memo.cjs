const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const newMemo = `  const { upNext, comingSoon, tonight, filteredLibrary } = useMemo(() => {
    const upNextRaw = shows.map(show => {
      const eps = episodesMap[show.id] || [];
      const unwatched = eps.filter(e => !e.watched && (e.airstamp ? isPast(new Date(e.airstamp)) : true));
      return { show, nextEp: unwatched[0], progress: Math.round(((eps.length - unwatched.length) / Math.max(eps.length, 1)) * 100) };
    }).filter(s => s.nextEp);

    const comingSoonRaw = shows.map(show => {
      const eps = episodesMap[show.id] || [];
      const future = eps.filter(e => e.airstamp && isFuture(new Date(e.airstamp)));
      return { show, nextEp: future[0] };
    }).filter(s => s.nextEp).sort((a, b) => new Date(a.nextEp.airstamp).getTime() - new Date(b.nextEp.airstamp).getTime());

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tonightRaw = comingSoonRaw.filter(s => s.nextEp.airdate === todayStr);

    let lib = [...shows];
    
    if (libraryFilter !== "all") {
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
    
    lib.sort((a, b) => {
      if (librarySort === "name") return a.name.localeCompare(b.name);
      if (librarySort === "added") return (b.addedAt || 0) - (a.addedAt || 0);
      if (librarySort === "progress") {
        const epsA = episodesMap[a.id] || [];
        const epsB = episodesMap[b.id] || [];
        const pctA = epsA.length ? Math.round((epsA.filter(e => e.watched).length / epsA.length) * 100) : 0;
        const pctB = epsB.length ? Math.round((epsB.filter(e => e.watched).length / epsB.length) * 100) : 0;
        return pctB - pctA;
      }
      return 0;
    });

    return { upNext: upNextRaw, comingSoon: comingSoonRaw, tonight: tonightRaw, filteredLibrary: lib };
  }, [shows, episodesMap, libraryFilter, librarySort]);`;

const startIndex = code.indexOf('  const { upNext, comingSoon } = useMemo(() => {');
const endIndex = code.indexOf('  }, [shows, episodesMap]);') + '  }, [shows, episodesMap]);'.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + newMemo + code.substring(endIndex);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Replaced');
} else {
  console.log('Not found');
}
