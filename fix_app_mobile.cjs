const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix Watch buttons from hover-only to visible on mobile
code = code.replace(
  /opacity-0 group-hover:opacity-100 transition-all/g,
  'opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all'
);

// Add pb-safe to App
// Wait, tabs are being moved to bottom nav! Let's do the tabs move first.
fs.writeFileSync('src/App.tsx', code);
