const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'handleRemoveShow(tvmazeId);',
  'handleRemoveShow();'
);

fs.writeFileSync('src/App.tsx', code);
