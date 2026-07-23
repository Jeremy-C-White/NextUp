const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const contentRegex = /(<main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12 pb-28">)([\s\S]*?)(\s*<\/main>)/;
const match = code.match(contentRegex);

if (match) {
  code = code.replace(contentRegex, `$1\n      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-12">\n${match[2]}\n      </div>$3`);
  
  // also need to remove space-y-12 from main so it doesn't double space
  code = code.replace('<main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12 pb-28">', '<main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-28">');
  fs.writeFileSync('src/App.tsx', code);
} else {
  console.log("Not found");
}
