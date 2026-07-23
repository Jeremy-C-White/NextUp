const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/text-white focus:outline-none/g, 'text-white text-base focus:outline-none');
code = code.replace(/min-h-screen/g, 'min-h-dvh');

fs.writeFileSync('src/components/AuthScreen.tsx', code);

// Same for SearchModal and DetailsModal and SettingsModal
['SearchModal.tsx', 'DetailsModal.tsx', 'SettingsModal.tsx'].forEach(file => {
  let fp = 'src/components/' + file;
  if(fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    content = content.replace(/<input(.*?)className="(.*?)"/g, (match, p1, p2) => {
      if(!p2.includes('text-base') && !p2.includes('text-lg') && !p2.includes('text-xl')) {
        return `<input${p1}className="${p2} text-base"`;
      }
      return match;
    });
    // Add overscroll-contain and max-h-[80dvh]
    content = content.replace(/max-h-\[80vh\]/g, 'max-h-[80dvh] overscroll-contain');
    // Also change fixed inset-0 onClick to onClose for backdrop
    fs.writeFileSync(fp, content);
  }
});
