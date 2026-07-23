const fs = require('fs');

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '<header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-4 sm:px-8 py-4 flex items-center justify-between">',
  '<header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-4 sm:px-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 flex items-center justify-between">'
);
fs.writeFileSync('src/App.tsx', codeApp);

let codeDet = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');
codeDet = codeDet.replace(
  '<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-24 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>',
  '<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-[calc(6rem+env(safe-area-inset-top))] bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>'
);
fs.writeFileSync('src/components/DetailsModal.tsx', codeDet);

let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
codeSearch = codeSearch.replace(
  '<div className="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-24 p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>',
  '<div className="fixed inset-0 z-50 flex items-start justify-center pt-[calc(1rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))] p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>'
);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

