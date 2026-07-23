const fs = require('fs');
['SearchModal.tsx', 'SettingsModal.tsx'].forEach(file => {
  let fp = 'src/components/' + file;
  if(fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    content = content.replace(/className="([^"]*w-full bg-slate-950[^"]*)"/g, (match, p1) => {
      if(!p1.includes('text-base')) {
        return `className="${p1} text-base"`;
      }
      return match;
    });
    fs.writeFileSync(fp, content);
  }
});
