const fs = require('fs');

let codeDet = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');
codeDet = codeDet.replace(
  '<div className="relative h-64 bg-slate-950 shrink-0">',
  '<div className="relative h-48 md:h-64 bg-slate-950 shrink-0">'
);
codeDet = codeDet.replace(
  '<div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[80dvh] overscroll-contain animate-in" onClick={(e) => e.stopPropagation()}>',
  '<div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] overscroll-contain animate-in" onClick={(e) => e.stopPropagation()}>'
);
fs.writeFileSync('src/components/DetailsModal.tsx', codeDet);

let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
codeSearch = codeSearch.replace(
  '<div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80dvh] overscroll-contain animate-in" onClick={(e) => e.stopPropagation()}>',
  '<div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] overscroll-contain animate-in" onClick={(e) => e.stopPropagation()}>'
);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

