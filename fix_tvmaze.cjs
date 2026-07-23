const fs = require('fs');
let code = fs.readFileSync('src/lib/tvmaze.ts', 'utf8');

const origResolve = `  // Fallback to name search
  const res = await fetch(\`\${BASE_URL}/search/shows?q=\${encodeURIComponent(show.name)}\`);
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) return data[0].show;
  }
  
  throw new Error("Could not find this show on TVMaze");`;

const newResolve = `  // Fallback to name search
  const res = await fetch(\`\${BASE_URL}/search/shows?q=\${encodeURIComponent(show.name)}\`);
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) {
      // Find a match that roughly matches the premiere year if we have it
      if (show.premiered) {
        const expectedYear = show.premiered.split('-')[0];
        const match = data.find((item: any) => item.show.premiered && item.show.premiered.startsWith(expectedYear));
        if (match) return match.show;
      } else {
        return data[0].show;
      }
    }
  }
  
  throw new Error("Could not confidently match this show on TVMaze - try searching for it manually.");`;

code = code.replace(origResolve, newResolve);
fs.writeFileSync('src/lib/tvmaze.ts', code);
