const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

code = code.replace(
  '{inLibrary === false && previewEps && previewEps.length > 0 && (',
  `<div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 md:hidden flex justify-center">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-base hover:bg-slate-700 active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
            {inLibrary === false && previewEps && previewEps.length > 0 && (`
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
