const fs = require('fs');

let codeSet = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');
codeSet = codeSet.replace(
  `  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);`,
  `  useEffect(() => {
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
  }, [isOpen]);`
);
fs.writeFileSync('src/components/SettingsModal.tsx', codeSet);

let codeSearch = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');
codeSearch = codeSearch.replace(
  `  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      inputRef.current?.focus();
    }
  }, [isOpen]);`,
  `  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);`
);
fs.writeFileSync('src/components/SearchModal.tsx', codeSearch);

