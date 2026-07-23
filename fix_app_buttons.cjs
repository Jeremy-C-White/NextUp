const fs = require('fs');

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '<CheckCircle2 className="w-3 h-3" /> Caught Up',
  '{addingShowId === show.id ? "Adding..." : <><CheckCircle2 className="w-3 h-3" /> Caught Up</>}'
);
codeApp = codeApp.replace(
  'className="bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1"',
  'disabled={addingShowId === show.id} className="bg-slate-800 hover:bg-slate-700 active:scale-95 touch-manipulation text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-2 py-1 px-2 rounded flex-1 text-center flex items-center justify-center gap-1 disabled:opacity-50"'
);

// P3 #19 snap-proximity on Discover rails
codeApp = codeApp.replace(
  /snap-x snap-mandatory/g,
  'snap-x snap-proximity'
);

fs.writeFileSync('src/App.tsx', codeApp);
