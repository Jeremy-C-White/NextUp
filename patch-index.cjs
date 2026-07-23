const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

code = code.replace(
  '<link rel="apple-touch-icon" href="/icon-192.png">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n    <link rel="icon" type="image/svg+xml" href="/icon.svg">'
);

fs.writeFileSync('index.html', code);
