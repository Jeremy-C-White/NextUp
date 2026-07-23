const fs = require('fs');
let code = fs.readFileSync('src/lib/tmdb.ts', 'utf8');
code = code.replace('const API_KEY = import.meta.env.VITE_TMDB_API_KEY || import.meta.env.TMDB_API_KEY;', 'const API_KEY = (import.meta as any).env.VITE_TMDB_API_KEY;');
fs.writeFileSync('src/lib/tmdb.ts', code);

code = fs.readFileSync('.env.example', 'utf8');
code = code.replace('TMDB_API_KEY=', 'VITE_TMDB_API_KEY=');
fs.writeFileSync('.env.example', code);
