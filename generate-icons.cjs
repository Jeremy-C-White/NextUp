const fs = require('fs');
const sharp = require('sharp');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f97316" />
  <svg x="100" y="100" width="312" height="312" viewBox="0 0 24 24" fill="none" stroke="#020617" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
</svg>`;

fs.writeFileSync('public/icon.svg', svgContent);

async function generate() {
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');
    
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');
    
  console.log('Icons generated successfully.');
}

generate().catch(console.error);
