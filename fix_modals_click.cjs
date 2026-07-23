const fs = require('fs');

['SearchModal.tsx', 'DetailsModal.tsx', 'SettingsModal.tsx'].forEach(file => {
  let fp = 'src/components/' + file;
  if(fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    
    // Replace outer div
    content = content.replace(
      /className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950\/80 backdrop-blur-sm"/g,
      'className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}'
    );
    // There might be variations of this string, let's use a regex
    content = content.replace(
      /<div className="fixed inset-0 z-50([^"]*)"( onClick=\{onClose\})?>/g,
      '<div className="fixed inset-0 z-50$1" onClick={onClose}>'
    );
    
    // Replace inner div
    content = content.replace(
      /<div className="([^"]*bg-slate-900 border border-slate-800[^"]*)"/g,
      '<div className="$1 animate-in" onClick={(e) => e.stopPropagation()}"'
    );

    fs.writeFileSync(fp, content);
  }
});
