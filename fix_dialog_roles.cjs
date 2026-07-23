const fs = require('fs');

const fixRole = (file, matchStr, replaceStr) => {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('role="dialog"')) {
    code = code.replace(matchStr, replaceStr);
    fs.writeFileSync(file, code);
  }
};

fixRole('src/components/DetailsModal.tsx', '<div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">', '<div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">');
fixRole('src/components/SearchModal.tsx', '<div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8 overflow-y-auto">', '<div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8 overflow-y-auto" role="dialog" aria-modal="true">');
fixRole('src/components/SettingsModal.tsx', '<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">', '<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">');
