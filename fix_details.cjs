const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsModal.tsx', 'utf8');

// Container
code = code.replace(
  '<div className="flex flex-col md:flex-row flex-1 min-h-0">',
  '<div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden overscroll-contain">'
);

// Sidebar
code = code.replace(
  '<div className="w-full md:w-64 p-6 border-r border-slate-800 shrink-0 overflow-y-auto overscroll-contain">',
  '<div className="w-full md:w-64 p-6 border-b md:border-b-0 md:border-r border-slate-800 md:shrink-0 md:overflow-y-auto">'
);

// Episodes Pane
code = code.replace(
  '<div className="flex-1 flex flex-col min-h-0">',
  '<div className="flex-1 flex flex-col md:min-h-0">'
);

// List
code = code.replace(
  '<div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">',
  '<div className="md:flex-1 md:overflow-y-auto overscroll-contain p-4 space-y-2">'
);

// Body scroll lock
code = code.replace(
  '  useEffect(() => {\n    if (isOpen && show.imdbId) {',
  `  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && show.imdbId) {`
);

// Tap-target stragglers - DetailsModal X button
code = code.replace(
  '<button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 z-10 transition-colors">',
  '<button onClick={onClose} className="absolute top-4 right-4 p-3 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 z-10 transition-colors active:scale-95 touch-manipulation">'
);

fs.writeFileSync('src/components/DetailsModal.tsx', code);
