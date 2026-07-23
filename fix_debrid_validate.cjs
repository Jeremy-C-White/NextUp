const fs = require('fs');
const code = fs.readFileSync('src/lib/debrid.ts', 'utf8');

const updated = code.replace(
  /export async function getBestTorrentioStream[\s\S]*?\{/,
  `export async function getBestTorrentioStream(imdbId: string, season: number, episode: number, type: 'series' | 'movie' = 'series'): Promise<PlaybackCandidate[]> {
  if (type === 'series') {
    if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1) {
      throw new Error("INVALID_EPISODE_MAPPING");
    }
  }`
);

fs.writeFileSync('src/lib/debrid.ts', updated);
