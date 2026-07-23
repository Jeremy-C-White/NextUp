const fs = require('fs');
const code = fs.readFileSync('src/lib/episodes.ts', 'utf8');

const updated = code.replace(
  /export function isRegularEpisode\(episode: AnyEpisode\): boolean \{[\s\S]*?\}/,
  `export function isRegularEpisode(episode: AnyEpisode): boolean {
  if (typeof episode.id === "string" && episode.id.startsWith("movie_")) return true;
  return (
    (!episode.type || episode.type === "regular") &&
    Number.isInteger(episode.season) &&
    Number.isInteger(episode.number) &&
    (episode.season ?? 0) > 0 &&
    (episode.number ?? 0) > 0
  );
}`
);

fs.writeFileSync('src/lib/episodes.ts', updated);
