const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

const upNextHeaderRegex = /<h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Ready to watch<\/h2>\s*<p className="text-slate-400">Pick up exactly where you left off\.<\/p>\s*<\/div>/g;

const upNextHeaderReplacement = `<h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Ready to watch</h2>
              <p className="text-slate-400">Pick up exactly where you left off.</p>
            </div>
            {upNext.length > 1 && (
              <button 
                onClick={() => {
                  const sorted = [...upNext].sort((a, b) => {
                    const aWatchedAt = Object.values(a.show.watchedEpisodes || {}).filter(v => v !== null) as number[];
                    const bWatchedAt = Object.values(b.show.watchedEpisodes || {}).filter(v => v !== null) as number[];
                    const aMax = aWatchedAt.length ? Math.max(...aWatchedAt) : 0;
                    const bMax = bWatchedAt.length ? Math.max(...bWatchedAt) : 0;
                    return aMax - bMax; // Oldest first
                  });
                  // Bias towards top 3 oldest
                  const pool = sorted.slice(0, Math.max(3, Math.floor(sorted.length / 2)));
                  const picked = pool[Math.floor(Math.random() * pool.length)];
                  setDetailsShow(picked.show);
                }}
                className="w-full mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-between hover:from-indigo-500/30 hover:to-purple-500/30 transition-colors group text-left"
              >
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">What should we watch tonight?</h3>
                  <p className="text-sm text-slate-300">Let us pick from your queue</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center group-active:scale-95 transition-transform shrink-0 shadow-xl shadow-indigo-500/20">
                  <PlayCircle className="w-5 h-5 text-white" />
                </div>
              </button>
            )}`;

codeApp = codeApp.replace(upNextHeaderRegex, upNextHeaderReplacement);
fs.writeFileSync('src/App.tsx', codeApp);
