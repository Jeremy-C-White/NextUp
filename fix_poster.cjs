const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

const oldStr = `              <img referrerPolicy="no-referrer" loading="lazy" src={show.backdropUrl || show.imageUrl} alt="" className="w-24 h-36 rounded-xl shadow-lg object-cover border border-slate-800" />`;
const newStr = `              <img referrerPolicy="no-referrer" loading="lazy" src={show.imageUrl} alt="" className="w-24 h-36 rounded-xl shadow-lg object-cover border border-slate-800" />`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
