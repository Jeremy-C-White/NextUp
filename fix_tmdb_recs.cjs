const fs = require('fs');

let codeTmdb = fs.readFileSync('src/lib/tmdb.ts', 'utf8');
codeTmdb = codeTmdb.replace(
  '    .filter(s => !tmdbIds.includes(s.id))',
  `    .filter(s => !tmdbIds.includes(s.id) && !(JSON.parse(localStorage.getItem('nextup_dismissed_recs') || '[]')).includes(s.id))`
);
fs.writeFileSync('src/lib/tmdb.ts', codeTmdb);

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// The For You rail rendering
const forYouTarget = `                  {forYou.map(show => (
                    <div key={show.id} className="w-32 sm:w-40 shrink-0 snap-start relative group">
                      <button 
                        onClick={() => handleAddShow(show)}
                        disabled={addingShowId === show.id}
                        className="w-full absolute inset-0 z-10 flex flex-col justify-end p-2 sm:p-4 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:opacity-100"
                      >
                        <span className="text-white font-bold text-xs sm:text-sm text-left line-clamp-2">{show.name}</span>
                        <div className="mt-2 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 rounded-lg text-xs font-bold uppercase transition-colors text-center shadow-lg active:scale-95 touch-manipulation disabled:opacity-50">
                          {addingShowId === show.id ? "Adding..." : "+ Add"}
                        </div>
                      </button>
                      <div className="aspect-[2/3] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-transform group-hover:scale-105 duration-300">
                        {show.image?.medium ? (
                          <img decoding="async" loading="lazy" src={show.image.medium} alt={show.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold p-2 text-center text-sm">{show.name}</div>
                        )}
                      </div>
                    </div>
                  ))}`;

const forYouReplace = `                  {forYou.map(show => (
                    <div key={show.id} className="w-32 sm:w-40 shrink-0 snap-start relative group">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const dismissed = JSON.parse(localStorage.getItem('nextup_dismissed_recs') || '[]');
                          localStorage.setItem('nextup_dismissed_recs', JSON.stringify([...dismissed, show._tmdbId]));
                          setForYou(prev => prev.filter(s => s.id !== show.id));
                        }}
                        className="absolute top-2 right-2 z-20 p-1.5 bg-slate-950/80 backdrop-blur rounded-full text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleAddShow(show)}
                        disabled={addingShowId === show.id}
                        className="w-full absolute inset-0 z-10 flex flex-col justify-end p-2 sm:p-4 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:opacity-100"
                      >
                        <span className="text-white font-bold text-xs sm:text-sm text-left line-clamp-2">{show.name}</span>
                        <div className="mt-2 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 rounded-lg text-xs font-bold uppercase transition-colors text-center shadow-lg active:scale-95 touch-manipulation disabled:opacity-50">
                          {addingShowId === show.id ? "Adding..." : "+ Add"}
                        </div>
                      </button>
                      <div className="aspect-[2/3] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-transform group-hover:scale-105 duration-300">
                        {show.image?.medium ? (
                          <img decoding="async" loading="lazy" src={show.image.medium} alt={show.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold p-2 text-center text-sm">{show.name}</div>
                        )}
                      </div>
                    </div>
                  ))}`;

codeApp = codeApp.replace(forYouTarget, forYouReplace);
fs.writeFileSync('src/App.tsx', codeApp);
