const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const handleAddShow = async (show: Show) => {',
  'const handleAddShow = async (show: Show, caughtUp: boolean = false) => {'
);

code = code.replace(
  'await addShowToLibrary(show);',
  'await addShowToLibrary(show, caughtUp);'
);

fs.writeFileSync('src/App.tsx', code);
