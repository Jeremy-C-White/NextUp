const fs = require('fs');

// 1. App.tsx
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// Remove Watch button in Discover cards
const watchBtnRegex = /<div className="absolute top-2 right-2 z-20">\s*<a[\s\S]*?Watch\s*<\/a>\s*<\/div>/g;
codeApp = codeApp.replace(watchBtnRegex, '');

// Fix "Ready to watch" image object-cover -> object-cover object-top
codeApp = codeApp.replace(
  'className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"',
  'className="w-full h-full object-cover object-top opacity-60 group-hover:opacity-80 transition-opacity"'
);

// Fix "Ready to watch" episode details (Up Next)
codeApp = codeApp.replace(
  `<p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">{nextEp.summary || "No description."}</p>`,
  `{(nextEp.airstamp || nextEp.airdate) && (
                        <div className="text-[10px] font-bold text-orange-400/80 uppercase tracking-wider mb-2">
                          Aired {format(new Date(nextEp.airstamp || nextEp.airdate), "MMM d, yyyy")}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">{nextEp.summary ? nextEp.summary.replace(/<[^>]+>/g, "") : "No description."}</p>`
);


// Fix "Airing Tonight"
codeApp = codeApp.replace(
  `<div className="w-24 h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0">`,
  `<div className="w-24 shrink-0 aspect-[2/3] bg-slate-950 rounded-xl overflow-hidden">`
);
codeApp = codeApp.replace(
  `<h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                        <p className="text-base text-slate-400 truncate">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>`,
  `<h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                        <p className="text-base text-slate-300 font-medium truncate mb-1">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                        {nextEp.summary && (
                          <p className="text-sm text-slate-500 line-clamp-2 leading-snug">{nextEp.summary.replace(/<[^>]+>/g, "")}</p>
                        )}`
);

// Fix "On the horizon"
codeApp = codeApp.replace(
  `<div className="w-24 h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0">`,
  `<div className="w-24 shrink-0 aspect-[2/3] bg-slate-950 rounded-xl overflow-hidden">`
); // Note: it will match the second one too because we already replaced the first one. Wait, replace() replaces the first match! So I should call it again, or use regex.
// Since I already called it once, calling it again will replace the second match (which is for "On the horizon").
codeApp = codeApp.replace(
  `<h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                      <p className="text-base text-slate-400 mb-2 truncate">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                      <div className="inline-block px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/20 text-orange-400 text-xs font-bold tracking-wide uppercase">`,
  `<h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                      <p className="text-base text-slate-300 font-medium truncate mb-1">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                      {nextEp.summary && (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-snug mb-3">{nextEp.summary.replace(/<[^>]+>/g, "")}</p>
                      )}
                      <div className="inline-block px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/20 text-orange-400 text-xs font-bold tracking-wide uppercase">`
);

fs.writeFileSync('src/App.tsx', codeApp);

// 2. DetailsModal.tsx
let codeDetails = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

codeDetails = codeDetails.replace(
  `<p className="text-slate-500 text-xs truncate">
                        {ep.airdate ? new Date(ep.airstamp || ep.airdate).toLocaleDateString() : "TBA"}
                      </p>
                    </div>`,
  `<p className="text-slate-500 text-xs truncate">
                        {ep.airdate ? new Date(ep.airstamp || ep.airdate).toLocaleDateString() : "TBA"}
                      </p>
                      {ep.summary && (
                        <p className="text-slate-400 text-xs line-clamp-2 mt-2 leading-snug break-words whitespace-normal">{ep.summary.replace(/<[^>]+>/g, "")}</p>
                      )}
                    </div>`
);

fs.writeFileSync('src/components/DetailsModal.tsx', codeDetails);

