const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const origStates = `  const [hiddenGems, setHiddenGems] = useState<Show[]>([]);
  const [forYou, setForYou] = useState<Show[]>([]);
  const [appError, setAppError] = useState<string | null>(null);
  const generationRef = useRef(0);`;

const newStates = `  const [hiddenGems, setHiddenGems] = useState<Show[]>([]);
  const [forYou, setForYou] = useState<Show[]>([]);
  const [appError, setAppError] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<"all" | "watching" | "caught-up" | "ended">("all");
  const [librarySort, setLibrarySort] = useState<"name" | "added" | "progress">("added");
  const generationRef = useRef(0);`;

code = code.replace(origStates, newStates);

const origMemo = `  const { upNext, comingSoon } = useMemo(() => {
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

    return { upNext: upNextRaw, comingSoon: comingSoonRaw };
  }, [shows, episodesMap]);`;

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
      if (librarySort === "added") return b.addedAt - a.addedAt;
      if (librarySort === "progress") {
        const epsA = episodesMap[a.id] || [];
        const epsB = episodesMap[b.id] || [];
        const pctA = epsA.length ? Math.round((epsA.filter(e => e.watched).length / epsA.length) * 100) : 0;
        const pctB = epsB.length ? Math.round((epsB.filter(e => e.watched).length / epsB.length) * 100) : 0;
        return pctA - pctB; // ascending progress, so closest to catching up is last? maybe descending progress: pctB - pctA
      }
      return 0;
    });

    return { upNext: upNextRaw, comingSoon: comingSoonRaw, tonight: tonightRaw, filteredLibrary: lib };
  }, [shows, episodesMap, libraryFilter, librarySort]);`;

code = code.replace(origMemo, newMemo);

// Replace mapping shows with filteredLibrary
code = code.replace(
  '{shows.map((show) => {',
  '{filteredLibrary.map((show) => {'
);

const origLibraryHeader = `            <div className="mb-6">
              <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Your library</h2>
              <p className="text-slate-400">All your saved series.</p>
            </div>`;

const newLibraryHeader = `            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Your library</h2>
                  <p className="text-slate-400">All your saved series.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    value={librarySort} 
                    onChange={(e) => setLibrarySort(e.target.value as any)}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="added">Recently Added</option>
                    <option value="name">Alphabetical</option>
                    <option value="progress">Progress</option>
                  </select>
                  <div className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto snap-x">
                    {(['all', 'watching', 'caught-up', 'ended'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => setLibraryFilter(filter)}
                        className={\`snap-start whitespace-nowrap px-3 py-1 text-sm font-medium rounded-md transition-colors \${libraryFilter === filter ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}\`}
                      >
                        {filter === 'all' ? 'All' : filter === 'watching' ? 'Watching' : filter === 'caught-up' ? 'Caught Up' : 'Ended'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>`;

code = code.replace(origLibraryHeader, newLibraryHeader);

const upNextTabHeader = `        {/* Up Next */}
        {activeTab === "up-next" && (
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Up Next</h2>
              <p className="text-slate-400">Episodes ready to watch.</p>
            </div>`;

const newUpNextTabHeader = `        {/* Up Next */}
        {activeTab === "up-next" && (
          <section>
            {tonight.length > 0 && (
              <div className="mb-10">
                <div className="mb-6">
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2 flex items-center gap-2"><Clock className="w-8 h-8 text-orange-500" /> Tonight</h2>
                  <p className="text-slate-400">Airing today.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tonight.map(({ show, nextEp }) => (
                    <div key={show.id} className="group relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-orange-500/50 transition-colors flex cursor-pointer" onClick={() => setDetailsShow(show)}>
                      <div className="w-1/3 min-w-[120px] relative bg-slate-950 shrink-0">
                        {show.imageUrl ? (
                          <img decoding="async" referrerPolicy="no-referrer" loading="lazy" src={show.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-800">{show.name[0]}</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900" />
                      </div>
                      <div className="flex-1 p-5 flex flex-col min-w-0">
                        <div className="mb-auto">
                          <span className="text-orange-400 font-bold text-[10px] uppercase tracking-widest mb-1 block">AIRING TODAY</span>
                          <h3 className="font-display font-bold text-lg text-white truncate group-hover:text-orange-400 transition-colors">{show.name}</h3>
                          <p className="text-sm text-slate-300 font-medium truncate mt-0.5">{nextEp.name}</p>
                          <p className="text-xs text-slate-500 font-mono mt-1">S{nextEp.season.toString().padStart(2, '0')} E{nextEp.number.toString().padStart(2, '0')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Up Next</h2>
              <p className="text-slate-400">Episodes ready to watch.</p>
            </div>`;

code = code.replace(upNextTabHeader, newUpNextTabHeader);

fs.writeFileSync('src/App.tsx', code);
