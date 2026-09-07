const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');
const attemptIndex = lines.findIndex(l => l.includes('const attemptPlayback = async () => {'));
const endIndex = lines.findIndex((l, i) => i > attemptIndex && l.includes('};'));
const block = lines.splice(attemptIndex, (endIndex - attemptIndex + 1));

const insertIndex = lines.findIndex(l => l.includes('const validateCurrentSource = useCallback'));
lines.splice(insertIndex, 0, ...block);
fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
