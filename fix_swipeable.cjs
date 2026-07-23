const fs = require('fs');
let code = fs.readFileSync('src/components/SwipeableCard.tsx', 'utf8');

code = code.replace(
  'export function SwipeableCard({ children, onMark }: { children: ReactNode, onMark: () => void }) {',
  'export function SwipeableCard({ children, onMark, key }: { children: ReactNode, onMark: () => void, key?: string | number }) {'
);

fs.writeFileSync('src/components/SwipeableCard.tsx', code);
