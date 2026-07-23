const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

const replacement = `            {inLibrary !== false && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 md:hidden flex justify-center">
                <button 
                  onClick={onClose}
                  className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-base hover:bg-slate-700 active:scale-95 transition-all touch-manipulation"
                >
                  Close
                </button>
              </div>
            )}
            {inLibrary === false && previewEps && previewEps.length > 0 && (`;

code = code.replace(
  /<div className="p-4 border-t border-slate-800 bg-slate-900\/90 backdrop-blur shrink-0 md:hidden flex justify-center">[\s\S]*?<\/button>\n\s*<\/div>\n\s*\{inLibrary === false && previewEps && previewEps.length > 0 && \(/,
  replacement
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
