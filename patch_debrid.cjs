const fs = require('fs');
let code = fs.readFileSync('src/lib/debrid.ts', 'utf8');

code = code.replace(
  /export async function getBestTorrentioStream\(imdbId: string, season: number, episode: number\): Promise<string> \{/g,
  `export async function getBestTorrentioStream(imdbId: string, season: number, episode: number, type: 'series' | 'movie' = 'series'): Promise<string> {`
);

code = code.replace(
  /fetch\(\`https:\/\/torrentio\.strem\.fun\/\$\{config\}\/stream\/series\/\$\{imdbId\}:\$\{season\}:\$\{episode\}\.json\`\);/g,
  `fetch(\`https://torrentio.strem.fun/\${config}/stream/\${type}/\${type === 'movie' ? imdbId : \`\${imdbId}:\${season}:\${episode}\`}.json\`);`
);

fs.writeFileSync('src/lib/debrid.ts', code);
