const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /\{show\.imdbId && show\.imdbId !== "none" \? \([\s\S]*?No Stream\n                          <\/button>\n                        \)\}/,
  `<button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handlePlayEpisode(show.id, show.imdbId, nextEp); 
                            }}
                            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 text-orange-950 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-orange-500/20"
                          >
                            <PlayCircle className="w-4 h-4" />
                            Play
                          </button>`
);

fs.writeFileSync('src/App.tsx', updated);
