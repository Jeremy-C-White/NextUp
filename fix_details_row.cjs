const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  /className=\{\`flex items-center gap-4 p-3/g,
  'className={`flex flex-wrap sm:flex-nowrap items-center gap-4 p-3'
);

code = code.replace(
  '<div className="flex items-center gap-2 shrink-0">',
  '<div className="flex items-center gap-2 shrink-0 w-full justify-end sm:w-auto">'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
