const fs = require('fs');
['SearchModal.tsx', 'DetailsModal.tsx', 'SettingsModal.tsx'].forEach(file => {
  let fp = 'src/components/' + file;
  if(fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    content = content.replace(/onClick=\{\(e\) => e\.stopPropagation\(\)\}"/g, 'onClick={(e) => e.stopPropagation()}');
    fs.writeFileSync(fp, content);
  }
});
