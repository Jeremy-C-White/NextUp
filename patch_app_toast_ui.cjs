const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const toastHtml = `
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800 text-white px-4 py-3 rounded-full shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <span className="text-sm font-medium whitespace-nowrap">{toast.message}</span>
          {toast.action && (
            <button 
              onClick={toast.action.onClick}
              className="text-orange-400 font-bold text-sm uppercase tracking-wide px-2 hover:text-orange-300 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {isSearchOpen && <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onAdd={(show) => { handleAddShow(show); setToast({ message: \`Added \${show.name}\` }); }} library={shows} />}
`;

code = code.replace(
  '{isSearchOpen && <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onAdd={(show) => handleAddShow(show)} library={shows} />}',
  toastHtml
);

fs.writeFileSync('src/App.tsx', code);
