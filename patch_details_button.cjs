const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  '<button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-950/50 hover:bg-slate-800 rounded-full text-white backdrop-blur transition-colors z-10">',
  '<button onClick={onClose} className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-slate-950/50 hover:bg-slate-800 rounded-full text-white backdrop-blur transition-colors z-50 touch-manipulation">'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
