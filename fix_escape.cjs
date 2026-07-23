const fs = require('fs');

const fixEscape = (file) => {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('useEffect(() => {') && code.includes('Escape')) return;
  const escapeHook = `
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
`;
  
  if (!code.includes('import { useEffect')) {
      code = code.replace('import React, { useState }', 'import React, { useState, useEffect }');
      code = code.replace('import { useState }', 'import { useState, useEffect }');
  }

  code = code.replace(
    'if (!isOpen) return null;',
    escapeHook + '\n  if (!isOpen) return null;'
  );
  fs.writeFileSync(file, code);
};

fixEscape('src/components/DetailsModal.tsx');
fixEscape('src/components/SearchModal.tsx');
fixEscape('src/components/SettingsModal.tsx');
