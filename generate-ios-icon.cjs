const fs = require('fs');
const sharp = require('sharp');

const svgContent = fs.readFileSync('public/icon.svg', 'utf8');

async function generate() {
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');
    
  console.log('iOS Icon generated successfully.');
}

generate().catch(console.error);
