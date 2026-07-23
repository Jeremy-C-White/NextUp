const fs = require('fs');
let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

codeSearch = codeSearch.replace(
  '<div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>',
  '<div className="fixed inset-0 z-50 flex items-start justify-center pt-[calc(1rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))] p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>'
);

fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);
