const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const origComingSoon = `        {/* Coming Soon */}
        {activeTab === "coming" && (
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">On the horizon</h2>
              <p className="text-slate-400">Upcoming episodes for your saved shows.</p>
            </div>
            <div className="space-y-4">
              {comingSoon.length === 0 ? (`;

const newComingSoon = `        {/* Coming Soon */}
        {activeTab === "coming" && (
          <section className="space-y-12">
            {tonight.length > 0 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">Airing Tonight</h2>
                  <p className="text-slate-400">Don't miss these episodes airing today.</p>
                </div>
                <div className="space-y-4">
                  {tonight.map(({ show, nextEp }) => (
                    <button 
                      key={show.id} 
                      onClick={() => setDetailsShow(show)}
                      className="w-full flex gap-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 items-center text-left hover:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                    >
                      <div className="w-24 h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0">
                        {show.imageUrl && <img decoding="async" referrerPolicy="no-referrer" loading="lazy" src={show.imageUrl} alt="" className="w-full h-full object-cover opacity-90" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Tonight</span>
                          <span className="text-xs text-slate-500">{show.provider}</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-white mb-1">{show.name}</h3>
                        <p className="text-sm text-slate-400">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">On the horizon</h2>
                <p className="text-slate-400">Upcoming episodes for your saved shows.</p>
              </div>
              <div className="space-y-4">
                {comingSoon.length === 0 ? (`;

code = code.replace(origComingSoon, newComingSoon);

const activeScaleClass = "active:scale-95";
// Add active:scale-95 to Up Next Mark button
code = code.replace(
  'className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"',
  'className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"'
);

// Add active:scale-95 to tabs
code = code.replace(
  'className={`flex shrink-0 items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${',
  'className={`flex shrink-0 items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors active:scale-95 ${'
);

fs.writeFileSync('src/App.tsx', code);
