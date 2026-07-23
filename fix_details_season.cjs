const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

const target = `            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Episodes</h3>
              <select`;

const replace = `            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Episodes</h3>
              <div className="flex items-center gap-3">
                {seasonFilter !== "all" && filteredEpisodes.some(e => !e.watched && e.airstamp && new Date(e.airstamp) <= new Date()) && (
                  <button onClick={() => onMarkThrough(
                    filteredEpisodes.filter(e => !e.watched && e.airstamp && new Date(e.airstamp) <= new Date()).map(e => e.id)
                  )} className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-lg active:scale-95 touch-manipulation">
                    Mark Season Watched
                  </button>
                )}
                <select`;

code = code.replace(target, replace);
code = code.replace('              </select>\n            </div>', '              </select>\n              </div>\n            </div>');

fs.writeFileSync('src/components/DetailsModal.tsx', code);
