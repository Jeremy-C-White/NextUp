const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const original = `{isSearchOpen && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <SearchModal 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
            onAddShow={handleAddShow} 
            library={shows}
          />
        </Suspense>
      )}`;

const replacement = `{isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchModal 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
            onAddShow={handleAddShow} 
            library={shows}
          />
        </Suspense>
      )}`;

code = code.replace(original, replacement);
fs.writeFileSync('src/App.tsx', code);
