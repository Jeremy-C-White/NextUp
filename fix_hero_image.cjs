const fs = require('fs');

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '<img decoding="async" referrerPolicy="no-referrer" loading="lazy" src={show.imageUrl} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />',
  '<img decoding="async" referrerPolicy="no-referrer" loading="lazy" src={show.backdropUrl || show.imageUrl} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />'
);
fs.writeFileSync('src/App.tsx', codeApp);
