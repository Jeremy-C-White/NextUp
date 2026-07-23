const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add Library Search State
codeApp = codeApp.replace(
  'const [libraryFilter, setLibraryFilter] = useState<"all" | "watching" | "caught-up" | "ended">("all");',
  'const [libraryFilter, setLibraryFilter] = useState<"all" | "watching" | "caught-up" | "ended">("all");\n  const [librarySearch, setLibrarySearch] = useState("");'
);

// 2. Compute Stats and update Library rendering
const libraryRegex = /<section>\s*<div className="mb-6">\s*<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">/g;

const libraryReplacement = `<section>
            {/* Stats Card */}
            {(() => {
              const currentYear = new Date().getFullYear();
              let epsThisYear = 0;
              let minutesThisYear = 0;
              let showWatchCounts: Record<string, {name: string, count: number}> = {};
              
              Object.values(episodesMap).forEach((eps) => {
                eps.forEach(ep => {
                  if (ep.watched && ep.watchedAt) {
                    const watchedYear = new Date(ep.watchedAt).getFullYear();
                    if (watchedYear === currentYear) {
                      epsThisYear++;
                      const runtime = ep.runtime || shows.find(s => s.tvmazeId === ep.showId)?.runtime || 45;
                      minutesThisYear += runtime;
                      
                      if (!showWatchCounts[ep.showId]) {
                         showWatchCounts[ep.showId] = { name: ep.showId.toString(), count: 0 };
                         const show = shows.find(s => s.tvmazeId === ep.showId);
                         if (show) showWatchCounts[ep.showId].name = show.name;
                      }
                      showWatchCounts[ep.showId].count++;
                    }
                  }
                });
              });
              
              if (epsThisYear === 0) return null;
              const topShow = Object.values(showWatchCounts).sort((a,b) => b.count - a.count)[0];
              const hoursThisYear = Math.round(minutesThisYear / 60);
              
              return (
                <div className="mb-8 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-display font-bold text-white mb-1">Your Year in Review</h3>
                    <p className="text-sm text-slate-400">Watch stats for {currentYear}</p>
                  </div>
                  <div className="flex flex-wrap gap-6 md:gap-8">
                    <div>
                      <div className="text-3xl font-display font-bold text-orange-400">{epsThisYear}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Episodes</div>
                    </div>
                    <div>
                      <div className="text-3xl font-display font-bold text-indigo-400">{hoursThisYear}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Hours</div>
                    </div>
                    {topShow && (
                       <div>
                        <div className="text-xl font-bold text-white max-w-[150px] truncate leading-tight pt-1.5">{topShow.name}</div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Most Watched</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

             <div className="mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-2">`;

codeApp = codeApp.replace(libraryRegex, libraryReplacement);

// 3. Add search input next to filters
const filtersRegex = /<select \s*value=\{librarySort\} /g;
const filtersReplacement = `<input 
                    type="text" 
                    placeholder="Search library..." 
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-base rounded-lg px-4 py-2 w-full md:w-48 focus:outline-none focus:border-orange-500"
                  />
                  <select 
                    value={librarySort} `;
codeApp = codeApp.replace(filtersRegex, filtersReplacement);

// 4. Update the filteredLibrary variable to include text search
const filteredLibraryRegex = /const filteredLibrary = library\n\s*\.filter\(item => \{\n\s*if \(!item\.show\) return false;\n\s*if \(\!item\.episodes\) return false;/g;
const filteredLibraryReplacement = `const filteredLibrary = library
            .filter(item => {
              if (!item.show) return false;
              if (!item.episodes) return false;
              if (librarySearch.trim() !== "") {
                if (!item.show.name.toLowerCase().includes(librarySearch.toLowerCase())) return false;
              }`;
codeApp = codeApp.replace(filteredLibraryRegex, filteredLibraryReplacement);

fs.writeFileSync('src/App.tsx', codeApp);
