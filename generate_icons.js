const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#020617"/>
  <rect x="128" y="160" width="256" height="192" rx="32" fill="none" stroke="#f97316" stroke-width="32"/>
  <path d="M224 224 L304 256 L224 288 Z" fill="#f97316"/>
</svg>
`;

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

sharp(Buffer.from(svg))
  .resize(192, 192)
  .png()
  .toFile(path.join('public', 'icon-192.png'));

sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile(path.join('public', 'icon-512.png'));

