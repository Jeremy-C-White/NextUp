const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '/></Suspense>',
  '/>\n      </Suspense>'
);
content = content.replace(
  '/></Suspense>',
  '/>\n        </Suspense>'
);

fs.writeFileSync('src/App.tsx', content);
