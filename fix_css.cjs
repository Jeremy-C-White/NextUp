const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace('    user-select: none;', '');
css += `
@layer base {
  button, a {
    user-select: none;
  }
}
`;
fs.writeFileSync('src/index.css', css);
