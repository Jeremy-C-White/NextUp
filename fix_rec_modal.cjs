const fs = require('fs');
const code = fs.readFileSync('src/components/RecommendationModal.tsx', 'utf8');

const updated = code.replace(/resolvingStreamId: string \| null;\n/g, '')
  .replace(/  resolvingStreamId,\n/g, '')
  .replace(/const isResolving = resolvingStreamId === show.id;/g, 'const isResolving = false;');

fs.writeFileSync('src/components/RecommendationModal.tsx', updated);
