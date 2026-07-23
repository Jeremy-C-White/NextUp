const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace Suspense fallback with a visual spinner
const modalFallback = `        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>`;

code = code.replace('<Suspense fallback={null}>', modalFallback);
code = code.replace('<Suspense fallback={null}>', modalFallback);

const preloader = `  useEffect(() => {
    if (user) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          import("./components/SearchModal");
          import("./components/DetailsModal");
        });
      } else {
        setTimeout(() => {
          import("./components/SearchModal");
          import("./components/DetailsModal");
        }, 2000);
      }
    }
  }, [user]);`;

// Insert after the onAuthStateChanged effect
code = code.replace(
  '  useEffect(() => {\n    return onAuthStateChanged(auth, (u) => {\n      setUser(u);\n      setLoading(false);\n    });\n  }, []);',
  '  useEffect(() => {\n    return onAuthStateChanged(auth, (u) => {\n      setUser(u);\n      setLoading(false);\n    });\n  }, []);\n\n' + preloader
);

code = code.replace(/hover:bg-slate-800 text-slate-300/g, 'hover:bg-slate-800 text-slate-300 active:scale-95 touch-manipulation');
code = code.replace(/hover:text-white/g, 'hover:text-white active:scale-95 touch-manipulation');
code = code.replace(/hover:text-orange-400/g, 'hover:text-orange-400 active:scale-95 touch-manipulation');
code = code.replace(/hover:bg-slate-800 transition-colors/g, 'hover:bg-slate-800 transition-colors active:scale-95 touch-manipulation');
code = code.replace(/hover:bg-orange-500/g, 'hover:bg-orange-500 active:scale-95 touch-manipulation');
code = code.replace(/<img /g, '<img decoding="async" ');

fs.writeFileSync('src/App.tsx', code);
