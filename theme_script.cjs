const fs = require('fs');

const replacements = [
  { from: 'bg-slate-950', to: 'bg-slate-50 dark:bg-slate-950' },
  { from: 'bg-slate-900', to: 'bg-white dark:bg-slate-900' },
  { from: 'bg-slate-800', to: 'bg-slate-200 dark:bg-slate-800' },
  { from: 'bg-slate-700', to: 'bg-slate-300 dark:bg-slate-700' },
  { from: 'border-slate-800', to: 'border-slate-200 dark:border-slate-800' },
  { from: 'border-slate-700', to: 'border-slate-300 dark:border-slate-700' },
  { from: 'border-slate-600', to: 'border-slate-400 dark:border-slate-600' },
  { from: 'text-slate-500', to: 'text-slate-500 dark:text-slate-400' }, // Wait, maybe text-slate-500 is fine
  { from: 'text-slate-400', to: 'text-slate-600 dark:text-slate-400' },
  { from: 'text-slate-300', to: 'text-slate-700 dark:text-slate-300' },
  { from: 'text-white', to: 'text-slate-900 dark:text-white' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We need to only replace inside className="..." or className={`...`}
  // A simple regex approach for className:
  content = content.replace(/className=(["'])(.*?)\1|className=\{`(.*?)`\}/g, (match, quote, p2, p3) => {
    let classes = p2 || p3;
    let newClasses = classes;
    
    // Split by space to handle individual classes
    let classList = newClasses.split(/\s+/);
    let modifiedList = classList.map(cls => {
      // Don't replace text-white inside buttons that are orange or red etc.
      // This is a bit tricky. We can look at the whole class list.
      if (cls === 'text-white' && (classList.includes('bg-orange-500') || classList.includes('bg-red-500') || classList.includes('bg-black/50'))) {
        return cls;
      }
      
      let replaceObj = replacements.find(r => r.from === cls);
      if (replaceObj) {
        // avoid duplicating if it already has dark: version
        if (!classList.includes(`dark:${cls}`)) {
           return replaceObj.to;
        }
      }
      return cls;
    });

    let result = modifiedList.join(' ');
    
    if (p2 !== undefined) {
      return `className=${quote}${result}${quote}`;
    } else {
      return `className={\`${result}\`}`;
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const glob = require('glob'); // Note: glob might not be installed, we can use fs.readdirSync
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walk('src');
files.forEach(processFile);
