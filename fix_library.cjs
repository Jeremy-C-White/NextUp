const fs = require('fs');
let code = fs.readFileSync('src/lib/library.ts', 'utf8');

const origAdd = `export async function addShowToLibrary(show: Show, caughtUp: boolean = false): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showId = show.id;
  const episodes = await getEpisodes(showId);

  const provider = show.webChannel?.name || show.network?.name || "Unknown Provider";

  const userShow: UserShow = {
    id: showId.toString(),
    tvmazeId: showId,
    name: show.name,
    imageUrl: show.image?.medium || show.image?.original || "",
    status: show.status || "Unknown",
    provider,
    addedAt: Date.now(),
    summary: show.summary ? show.summary.replace(/<[^>]+>/g, '') : "",
    imdbId: show.externals?.imdb || "",
    genres: show.genres || [],
    runtime: show.runtime || 0,
    officialSite: show.officialSite || "",
    backdropUrl: show.image?.original || "",
    watchedEpisodes: caughtUp ? episodes.filter(ep => ep.airstamp && new Date(ep.airstamp) < new Date()).reduce((acc, ep) => ({ ...acc, [ep.id.toString()]: Date.now() }), {}) : {}
  };

  const userEpisodes: UserEpisode[] = episodes.map(ep => {
    const isWatched = caughtUp && ep.airstamp && new Date(ep.airstamp) < new Date();
    return {
      id: ep.id.toString(),
      showId,
      season: ep.season,
      number: ep.number,
      name: ep.name,
      airdate: ep.airdate,
      airstamp: ep.airstamp,
      imageUrl: ep.image?.medium || ep.image?.original || "",
      summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : "",
      watched: !!isWatched,
      watchedAt: isWatched ? Date.now() : undefined
    };
  });

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await setDoc(showRef, userShow);
  
  return { userShow, userEpisodes };
}`;

const newAdd = `export async function addShowToLibrary(show: Show, caughtUp: boolean = false): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showId = show.id;
  
  let watchedEpisodes = {};
  if (caughtUp) {
    const episodes = await getEpisodes(showId);
    watchedEpisodes = episodes.filter(ep => ep.airstamp && new Date(ep.airstamp) < new Date()).reduce((acc, ep) => ({ ...acc, [ep.id.toString()]: Date.now() }), {});
  }

  const provider = show.webChannel?.name || show.network?.name || "Unknown Provider";

  const userShow: UserShow = {
    id: showId.toString(),
    tvmazeId: showId,
    name: show.name,
    imageUrl: show.image?.medium || show.image?.original || "",
    status: show.status || "Unknown",
    provider,
    addedAt: Date.now(),
    summary: show.summary ? show.summary.replace(/<[^>]+>/g, '') : "",
    imdbId: show.externals?.imdb || "",
    genres: show.genres || [],
    runtime: show.runtime || 0,
    officialSite: show.officialSite || "",
    backdropUrl: show.image?.original || "",
    watchedEpisodes
  };

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await setDoc(showRef, userShow);
  
  return { userShow, userEpisodes: [] };
}`;

code = code.replace(origAdd, newAdd);
fs.writeFileSync('src/lib/library.ts', code);
