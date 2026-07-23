const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('const [addingShowId, setAddingShowId] = useState<number | null>(null);')) {
  code = code.replace(
    'const [isSearchOpen, setIsSearchOpen] = useState(false);',
    'const [isSearchOpen, setIsSearchOpen] = useState(false);\n  const [addingShowId, setAddingShowId] = useState<number | null>(null);'
  );
  
  const origHandleAdd = `  const handleAddShow = (show: Show, caughtUp: boolean = false) => {
    setIsSearchOpen(false);
    setAppError(null);
    
    resolveTVMazeShow(show)
      .then(resolvedShow => addShowToLibrary(resolvedShow, caughtUp))
      .catch(err => {
        console.error(err);
        setAppError("Add Show Error: " + err.message);
      });
  };`;
  
  const newHandleAdd = `  const handleAddShow = (show: Show, caughtUp: boolean = false) => {
    setIsSearchOpen(false);
    setAppError(null);
    if (addingShowId === show.id) return; // Prevent double clicks
    
    setAddingShowId(show.id);
    resolveTVMazeShow(show)
      .then(resolvedShow => addShowToLibrary(resolvedShow, caughtUp))
      .catch(err => {
        console.error(err);
        setAppError("Add Show Error: " + err.message);
      })
      .finally(() => {
        setAddingShowId(null);
      });
  };`;
  
  code = code.replace(origHandleAdd, newHandleAdd);
  
  // Also, add "Adding..." to the add buttons in Discover view
  // Search for: <button onClick={() => handleAddShow(show)} className="px-3 py-1.5 bg-slate-800...
  // and <button onClick={() => handleAddShow(show, true)} ...
  
  code = code.replace(/<button([^>]+onClick=\{\(\) => handleAddShow\(show\)\}[^>]+)>/g, (match, p1) => {
    return `<button\${p1} disabled={addingShowId === show.id}>`;
  });
  code = code.replace(/<button([^>]+onClick=\{\(\) => handleAddShow\(show, true\)\}[^>]+)>/g, (match, p1) => {
    return `<button\${p1} disabled={addingShowId === show.id}>`;
  });
  
  code = code.replace(/Add<\/button>/g, '{addingShowId === show.id ? "..." : "Add"}</button>');
  code = code.replace(/Caught Up<\/button>/g, '{addingShowId === show.id ? "..." : "Caught Up"}</button>');
  
  fs.writeFileSync('src/App.tsx', code);
}
