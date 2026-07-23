const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'handleAddShow(previewSource, caughtUp);',
  'handleAddShow(previewSource, caughtUp);\n              setToast({ message: `Added ${previewSource.name}` });'
);

code = code.replace(
  'onRemove={handleRemoveShow}',
  'onRemove={(tvmazeId) => {\n            handleRemoveShow(tvmazeId);\n            setToast({ message: `Removed from library` });\n          }}'
);

fs.writeFileSync('src/App.tsx', code);
