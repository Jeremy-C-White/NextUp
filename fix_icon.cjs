const fs = require('fs');

let index = fs.readFileSync('index.html', 'utf8');
index = index.replace('/icon-192.png', '/icon.svg');
fs.writeFileSync('index.html', index);

let manifest = fs.readFileSync('public/manifest.json', 'utf8');
manifest = manifest.replace(/\/icon-192\.png/g, '/icon.svg');
manifest = manifest.replace(/\/icon-512\.png/g, '/icon.svg');
manifest = manifest.replace(/image\/png/g, 'image/svg+xml');
fs.writeFileSync('public/manifest.json', manifest);
