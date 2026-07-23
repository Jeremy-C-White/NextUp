const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '<Suspense fallback={null}><SearchModal \n        isOpen={isSearchOpen} \n        onClose={() => setIsSearchOpen(false)} \n        onAddShow={handleAddShow} \n        library={shows}\n      />',
  '<Suspense fallback={null}><SearchModal \n        isOpen={isSearchOpen} \n        onClose={() => setIsSearchOpen(false)} \n        onAddShow={handleAddShow} \n        library={shows}\n      /></Suspense>'
);

fs.writeFileSync('src/App.tsx', content);
