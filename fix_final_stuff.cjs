const fs = require('fs');

// 1. App.tsx: getShow instead of resolveTVMazeShow
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  'import { getTrendingShows, getPremieringSoon, getHiddenGems, getForYou, resolveTVMazeShow } from "./lib/tvmaze";',
  'import { getTrendingShows, getPremieringSoon, getHiddenGems, getForYou, resolveTVMazeShow, getShow } from "./lib/tvmaze";'
);
codeApp = codeApp.replace(
  'const freshShow = await resolveTVMazeShow({ id } as any);',
  'const freshShow = await getShow(id);'
);
fs.writeFileSync('src/App.tsx', codeApp);

// 2. SearchModal.tsx: Add body scroll lock
let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
const searchLock = `  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);`;
const searchLockNew = `  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);`;
codeSearch = codeSearch.replace(searchLock, searchLockNew);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

// 3. main.tsx: Remove public state/props
let codeMain = fs.readFileSync('src/main.tsx', 'utf8');
codeMain = codeMain.replace('  public state: State;\n  public props: Props;\n', '');
fs.writeFileSync('src/main.tsx', codeMain);

