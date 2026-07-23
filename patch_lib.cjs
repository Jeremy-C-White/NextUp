const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

code = code.replace(
  /export async function getShowEpisodes\(showId: number, watchedEpisodes: Record<string, number \| null> = \{\}\): Promise<UserEpisode\[\]> \{/g,
  `export async function getShowEpisodes(showId: number, watchedEpisodes: Record<string, number | null> = {}, isMovie?: boolean): Promise<UserEpisode[]> {
  if (isMovie) {
    return [{
      id: "movie_" + showId,
      showId,
      season: 1,
      number: 1,
      name: "Movie",
      airdate: "",
      airstamp: "",
      imageUrl: "",
      summary: "",
      watched: !!watchedEpisodes["movie_" + showId],
      watchedAt: watchedEpisodes["movie_" + showId] || undefined
    }];
  }`
);

code = code.replace(
  /const episodes = await getEpisodes\(showId\);/g,
  `let episodes = [];
  if ((show as any)?._isMovie) {
    episodes = [{ id: "movie_" + showId, airstamp: new Date().toISOString() }];
  } else {
    episodes = await getEpisodes(showId);
  }`
);

fs.writeFileSync('src/lib/library.ts', code);
