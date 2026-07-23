const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'import { OnboardingScreen } from "./components/OnboardingScreen";',
  'import { OnboardingScreen } from "./components/OnboardingScreen";\nimport { SwipeableCard } from "./components/SwipeableCard";'
);

const upNextRegex = /(<article[^>]*?onClick=\{\(\) => setDetailsShow\(show\)\}[^>]*?>\s*)(<div className="relative aspect-video rounded-2xl overflow-hidden mb-3">)([\s\S]*?)(<\/article>)/g;

let count = 0;
code = code.replace(upNextRegex, (match, p1, p2, p3, p4) => {
  // Only the first section mapping upNext has these. We can use a replacer.
  // Actually, wait, both Up Next and Coming Soon use similar structures.
  // We want to wrap the inside of article with SwipeableCard.
  // But wait, what if we wrap the whole <article> except we don't want the article itself to be swipable or we do?
  // Let's replace only the first occurrence or just use a more targeted replacement.
  return match;
});

fs.writeFileSync('src/App.tsx', code);
