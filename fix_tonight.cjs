const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<span className="text-xs font-bold uppercase tracking-wider text-orange-400">Tonight</span>`;
const replacement = `<span className="text-xs font-bold uppercase tracking-wider text-orange-400">Tonight &middot; {format(new Date(nextEp.airstamp), "h:mm a")}</span>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/App.tsx', code);
