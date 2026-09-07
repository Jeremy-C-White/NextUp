const fs = require('fs');
const content = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

const lines = content.split('\n');

const loadIntroDBIndex = lines.findIndex(l => l.includes('async function loadIntroDB() {'));

if (loadIntroDBIndex !== -1) {
  lines.splice(loadIntroDBIndex, 0, '    skipExecutionLock.current = false;');
  fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
  console.log('Added skipExecutionLock reset');
}
