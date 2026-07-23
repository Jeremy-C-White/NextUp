const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  'import { SearchModal } from "./components/SearchModal";',
  'import { lazy, Suspense } from "react";\nconst SearchModal = lazy(() => import("./components/SearchModal").then(module => ({ default: module.SearchModal })));'
);

content = content.replace(
  'import { DetailsModal } from "./components/DetailsModal";',
  'const DetailsModal = lazy(() => import("./components/DetailsModal").then(module => ({ default: module.DetailsModal })));'
);

content = content.replace(
  '<SearchModal',
  '<Suspense fallback={null}><SearchModal'
);
content = content.replace(
  '        />\n      )}',
  '        /></Suspense>\n      )}'
);

content = content.replace(
  '<DetailsModal',
  '<Suspense fallback={null}><DetailsModal'
);
// replace closing of DetailsModal
content = content.replace(
  'onMarkThrough={handleMarkThrough}\n        />\n      )}',
  'onMarkThrough={handleMarkThrough}\n        /></Suspense>\n      )}'
);


fs.writeFileSync('src/App.tsx', content);
