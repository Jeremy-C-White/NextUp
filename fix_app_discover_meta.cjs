const fs = require('fs');
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

const titleRegex = /<h3 className="text-white font-display font-bold leading-tight line-clamp-2 mt-1">\{show.name\}<\/h3>/g;
const titleReplacement = `<h3 className="text-white font-display font-bold leading-tight line-clamp-2 mt-1">{show.name}</h3>
                              {show.genres && show.genres.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5 opacity-80">
                                  {show.genres.slice(0, 2).map(g => (
                                    <span key={g} className="text-[9px] font-bold uppercase tracking-widest text-slate-300 border border-slate-700/50 bg-slate-900/50 px-1.5 py-0.5 rounded backdrop-blur-sm">{g}</span>
                                  ))}
                                </div>
                              )}`;

codeApp = codeApp.replace(titleRegex, titleReplacement);

const ratingRegex = /<div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950\/20 to-transparent p-4 flex flex-col justify-end pointer-events-none">/g;
const ratingReplacement = `{(show.rating?.average || show.vote_average) ? (
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800">
                                <span className="text-orange-400 text-[10px] tracking-tighter">★</span>
                                <span className="text-white text-[10px] font-bold">{(show.rating?.average || (show.vote_average ? show.vote_average.toFixed(1) : ''))}</span>
                              </div>
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent p-4 flex flex-col justify-end pointer-events-none">`;

codeApp = codeApp.replace(ratingRegex, ratingReplacement);

fs.writeFileSync('src/App.tsx', codeApp);

// SearchModal.tsx
let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
const searchMetaRegex = /<p className="text-slate-400 text-xs mt-1 font-mono">\s*\{\[show\.premiered\?\.split\('-'\)\[0\], show\.status, show\.network\?\.name \|\| show\.webChannel\?\.name\]\.filter\(Boolean\)\.join\(" \· "\)\}\s*<\/p>/g;
const searchMetaReplacement = `<p className="text-slate-400 text-xs mt-1 font-mono flex items-center flex-wrap gap-1">
                          {[show.premiered?.split('-')[0], show.status, show.network?.name || show.webChannel?.name].filter(Boolean).join(" · ")}
                          {show.rating?.average && (
                            <span className="inline-flex items-center gap-0.5 text-orange-400 ml-1">
                              <span className="text-[10px]">★</span>
                              <span className="font-bold text-white">{show.rating.average}</span>
                            </span>
                          )}
                        </p>`;
codeSearch = codeSearch.replace(searchMetaRegex, searchMetaReplacement);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

