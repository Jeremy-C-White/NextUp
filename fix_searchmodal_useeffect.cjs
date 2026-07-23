const fs = require('fs');
let code = fs.readFileSync('src/components/SearchModal.tsx', 'utf8');

code = code.replace(
  `  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);`,
  ''
);

fs.writeFileSync('src/components/SearchModal.tsx', code);
