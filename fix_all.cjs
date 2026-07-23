const fs = require('fs');

// 1. SearchModal.tsx
let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
codeSearch = codeSearch.replace(
  '<div className="flex-1 py-1">',
  '<div className="flex-1 min-w-0 py-1">'
);
codeSearch = codeSearch.replace(
  '<p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-snug" >',
  '<p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-snug break-words" >'
);
codeSearch = codeSearch.replace(
  '<div className="mt-3 flex justify-end gap-2">',
  '<div className="mt-3 flex flex-wrap justify-end gap-2">'
);
codeSearch = codeSearch.replace(
  '<div className="flex gap-2">',
  '<div className="flex flex-wrap gap-2 justify-end">'
);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

// 2. App.tsx
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');

// Tonight row
codeApp = codeApp.replace(
  `                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Tonight &middot; {format(new Date(nextEp.airstamp), "h:mm a")}</span>
                          <span className="text-xs text-slate-500">{show.provider}</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-white mb-1">{show.name}</h3>
                        <p className="text-base text-slate-400">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                      </div>`,
  `                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-400 whitespace-nowrap shrink-0">Tonight &middot; {format(new Date(nextEp.airstamp), "h:mm a")}</span>
                          <span className="text-xs text-slate-500 truncate">{show.provider}</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                        <p className="text-base text-slate-400 truncate">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>
                      </div>`
);

// Coming Soon row
codeApp = codeApp.replace(
  `                    <div className="flex-1">
                      <h3 className="text-xl font-display font-bold text-white mb-1">{show.name}</h3>
                      <p className="text-base text-slate-400 mb-2">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>`,
  `                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-display font-bold text-white mb-1 truncate">{show.name}</h3>
                      <p className="text-base text-slate-400 mb-2 truncate">S{nextEp.season} E{nextEp.number} · {nextEp.name}</p>`
);

// Up Next episode line
codeApp = codeApp.replace(
  `                    <div className="p-5 flex-1 flex flex-col">
                      <div className="text-base font-medium text-slate-300 mb-1">`,
  `                    <div className="p-5 flex-1 flex flex-col min-w-0">
                      <div className="text-base font-medium text-slate-300 mb-1 truncate">`
);

// Discover card buttons (change tracking-widest to tracking-wider and add min-w-0)
codeApp = codeApp.replace(
  'disabled={addingShowId === show.id} className="bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1 disabled:opacity-50"',
  'disabled={addingShowId === show.id} className="bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation text-slate-300 text-[10px] font-bold uppercase tracking-wider mb-2 py-1 px-2 rounded flex-1 min-w-0 text-center flex items-center justify-center gap-1 disabled:opacity-50"'
);
codeApp = codeApp.replace(
  'className="bg-orange-500 hover:bg-orange-400 active:scale-95 touch-manipulation text-slate-950 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center"',
  'className="bg-orange-500 hover:bg-orange-400 active:scale-95 touch-manipulation text-slate-950 text-[10px] font-bold uppercase tracking-wider mb-2 py-1 px-2 rounded flex-1 min-w-0 text-center"'
);

fs.writeFileSync('src/App.tsx', codeApp);

// 3. DetailsModal.tsx
let codeDetails = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');
codeDetails = codeDetails.replace(
  '<div className="flex-1 pb-2">',
  '<div className="flex-1 min-w-0 pb-2">'
);
codeDetails = codeDetails.replace(
  '<h2 className="text-4xl font-display font-bold text-white leading-none mt-1 mb-2">{show.name}</h2>',
  '<h2 className="text-2xl md:text-4xl font-display font-bold text-white leading-tight md:leading-none mt-1 mb-2 line-clamp-2">{show.name}</h2>'
);
fs.writeFileSync('src/components/DetailsModal.tsx', codeDetails);

// 4. index.css
let codeCss = fs.readFileSync('src/index.css', 'utf8');
codeCss = codeCss.replace(
  '@layer base {\n  * {\n    -webkit-tap-highlight-color: transparent;\n  }',
  '@layer base {\n  html, body { overflow-x: hidden; }\n  * {\n    -webkit-tap-highlight-color: transparent;\n  }'
);
fs.writeFileSync('src/index.css', codeCss);
