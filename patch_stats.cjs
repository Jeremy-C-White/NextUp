const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const statsRegex = /\{activeTab === "library" && \(\n\s*<section>\n\s*\{\/\* Stats Card \*\/\}\n\s*\{\(\(\) => \{([\s\S]*?)\}\)\(\)\}/;

const newStats = `{activeTab === "library" && (
          <section>
            {/* Stats Card */}
            {(() => {
              let epsTotal = 0;
              let minutesTotal = 0;
              let showWatchCounts: Record<string, {name: string, count: number}> = {};
              
              (Object.values(episodesMap) as UserEpisode[][]).forEach((eps) => {
                eps.forEach(ep => {
                  if (ep.watched) {
                    epsTotal++;
                    const runtime = shows.find(s => s.tvmazeId === ep.showId)?.runtime || 45;
                    minutesTotal += runtime;
                    
                    if (!showWatchCounts[ep.showId]) {
                       showWatchCounts[ep.showId] = { name: ep.showId.toString(), count: 0 };
                       const show = shows.find(s => s.tvmazeId === ep.showId);
                       if (show) showWatchCounts[ep.showId].name = show.name;
                    }
                    showWatchCounts[ep.showId].count++;
                  }
                });
              });
              
              if (epsTotal === 0) return null;
              const topShow = Object.values(showWatchCounts).sort((a,b) => b.count - a.count)[0];
              const hoursTotal = Math.round(minutesTotal / 60);
              
              return (
                <div className="mb-8 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-display font-bold text-white mb-1">Your Watch Stats</h3>
                    <p className="text-sm text-slate-400">All-time overview</p>
                  </div>
                  <div className="flex flex-wrap gap-6 md:gap-8">
                    <div>
                      <div className="text-3xl font-display font-bold text-orange-400">{epsTotal}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Episodes</div>
                    </div>
                    <div>
                      <div className="text-3xl font-display font-bold text-indigo-400">{hoursTotal}</div>
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
            })()}`;

code = code.replace(statsRegex, newStats);
fs.writeFileSync('src/App.tsx', code);
