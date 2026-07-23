const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

// Through Here button
code = code.replace(/px-2 py-1 bg-slate-800 rounded-md/g, 'px-3 py-2 bg-slate-800 rounded-lg');

// Check toggle & play link
code = code.replace(/className={`p-2 rounded-lg/g, 'className={`p-3 rounded-xl');
code = code.replace(/className="p-2 text-indigo-400/g, 'className="p-3 text-indigo-400 rounded-xl');

// And there is also a text-[10px] uppercase in Through Here that's fine, we just changed the padding.
// The user also mentioned text-[10px] card pills in App.tsx (Up Next pills etc)
fs.writeFileSync('src/components/DetailsModal.tsx', code);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
// Up Next Pill
appCode = appCode.replace(/px-2 py-0\.5 rounded-md bg-orange-500\/20/g, 'px-3 py-2 rounded-lg bg-orange-500/20');
// Coming soon pill
appCode = appCode.replace(/px-3 py-1 bg-orange-500\/10/g, 'px-4 py-2 bg-orange-500/10 rounded-lg');

// Ensure select-none on cards/buttons
// We can just add it globally or to specific elements, but easiest is to add to index.css
fs.writeFileSync('src/App.tsx', appCode);

let css = fs.readFileSync('src/index.css', 'utf8');
if (!css.includes('select-none')) {
  css = css.replace(
    '-webkit-tap-highlight-color: transparent;',
    '-webkit-tap-highlight-color: transparent;\n    user-select: none;'
  );
  fs.writeFileSync('src/index.css', css);
}

