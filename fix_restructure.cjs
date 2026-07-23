const fs = require('fs');

// 1. types.ts
let types = fs.readFileSync('src/types.ts', 'utf8');
if (!types.includes('watchedEpisodes')) {
  types = types.replace(
    '  imdbId?: string;\n}',
    '  imdbId?: string;\n  watchedEpisodes?: Record<string, number | null>;\n}'
  );
  fs.writeFileSync('src/types.ts', types);
}

// 2. library.ts
let library = fs.readFileSync('src/lib/library.ts', 'utf8');

library = library.replace(
  /export async function addShowToLibrary\(show: Show\): Promise<\{ userShow: UserShow, userEpisodes: UserEpisode\[\] \}> \{[\s\S]*?processWrites\(\);\n  return \{ userShow, userEpisodes \};\n\}/,
  `export async function addShowToLibrary(show: Show): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {
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
    watchedEpisodes: {}
  };

  const userEpisodes: UserEpisode[] = episodes.map(ep => ({
    id: ep.id.toString(),
    showId,
    season: ep.season,
    number: ep.number,
    name: ep.name,
    airdate: ep.airdate,
    airstamp: ep.airstamp,
    imageUrl: ep.image?.medium || ep.image?.original || "",
    summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : "",
    watched: false
  }));

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await setDoc(showRef, userShow);
  
  return { userShow, userEpisodes };
}`
);

// We need to keep removeShowFromLibrary to remove the show doc, but it can stop deleting episodes! (Wait, existing episodes subcollection will be orphaned but that's fine as per user)
library = library.replace(
  /export async function removeShowFromLibrary\(showId: number\): Promise<void> \{[\s\S]*?await currentBatch\.commit\(\);\n\}/,
  `export async function removeShowFromLibrary(showId: number): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await deleteDoc(showRef);
}`
);

// getShowEpisodes
library = library.replace(
  /export async function getShowEpisodes\(showId: number\): Promise<UserEpisode\[\]> \{[\s\S]*?return snapshot\.docs\.map.*?\}\);\n\}/,
  `export async function getShowEpisodes(showId: number, watchedEpisodes: Record<string, number | null> = {}): Promise<UserEpisode[]> {
  const episodes = await getEpisodes(showId);
  return episodes.map(ep => ({
    id: ep.id.toString(),
    showId,
    season: ep.season,
    number: ep.number,
    name: ep.name,
    airdate: ep.airdate,
    airstamp: ep.airstamp,
    imageUrl: ep.image?.medium || ep.image?.original || "",
    summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : "",
    watched: !!watchedEpisodes[ep.id],
    watchedAt: watchedEpisodes[ep.id] || undefined
  })).sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });
}`
);

// markEpisodeWatched
library = library.replace(
  /export async function markEpisodeWatched\(showId: number, episodeId: string, watched: boolean\): Promise<void> \{[\s\S]*?setDoc.*?catch\(console\.error\);\n\}/,
  `export async function markEpisodeWatched(showId: number, episodeId: string, watched: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await setDoc(showRef, {
    watchedEpisodes: {
      [episodeId]: watched ? Date.now() : null
    }
  }, { merge: true });
}`
);

// markEpisodesWatchedBatch
library = library.replace(
  /export async function markEpisodesWatchedBatch\(showId: number, episodesToMark: string\[\], watched: boolean\): Promise<void> \{[\s\S]*?await currentBatch\.commit\(\);\n  \}\n\}/,
  `export async function markEpisodesWatchedBatch(showId: number, episodesToMark: string[], watched: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const updates: Record<string, number | null> = {};
  for (const epId of episodesToMark) {
    updates[epId] = watched ? Date.now() : null;
  }

  const showRef = doc(db, \`users/\${user.uid}/shows/\${showId}\`);
  await setDoc(showRef, {
    watchedEpisodes: updates
  }, { merge: true });
}`
);

// add onSnapshot export? No, we will do it in App.tsx directly or here. Let's do it in App.tsx. We don't have to export onSnapshot from library.ts, we can just use `onSnapshot` in `App.tsx`.
fs.writeFileSync('src/lib/library.ts', library);

// 3. App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  'import { getLibraryShows, addShowToLibrary, getShowEpisodes, markEpisodeWatched, markEpisodesWatchedBatch, removeShowFromLibrary } from "./lib/library";',
  'import { addShowToLibrary, getShowEpisodes, markEpisodeWatched, markEpisodesWatchedBatch, removeShowFromLibrary } from "./lib/library";\nimport { collection, onSnapshot, query } from "firebase/firestore";\nimport { db } from "./firebase";'
);

app = app.replace(
  /const fetchLibrary = async \(\) => \{[\s\S]*?\};\n/,
  `const fetchLibrary = () => {
    if (!user) return;
    setAppError(null);
    const showsRef = collection(db, \`users/\${user.uid}/shows\`);
    const q = query(showsRef);
    return onSnapshot(q, async (snapshot) => {
      try {
        const userShows = snapshot.docs.map(d => d.data() as UserShow);
        setShows(userShows);
        const eps: Record<string, UserEpisode[]> = {};
        await Promise.all(userShows.map(async (show) => {
          const id = show.tvmazeId || parseInt(show.id, 10);
          eps[show.id] = await getShowEpisodes(id, show.watchedEpisodes || {});
        }));
        setEpisodesMap(eps);
      } catch (e: any) {
        console.error(e);
        setAppError("Fetch Error: " + e.message);
      }
    });
  };`
);

app = app.replace(
  '  useEffect(() => {\n    if (user) {\n      fetchLibrary();\n    }\n  }, [user]);',
  '  useEffect(() => {\n    if (user) {\n      const unsubscribe = fetchLibrary();\n      return () => {\n        if (unsubscribe) unsubscribe();\n      };\n    }\n  }, [user]);'
);

// We need to useMemo for upNext and comingSoon and the calculations.
app = app.replace(
  '  // Calculate Up Next\n  const upNext = shows.map',
  `  const { upNext, comingSoon } = React.useMemo(() => {
    const upNext = shows.map`
);

app = app.replace(
  '  // Calculate Coming Soon\n  const comingSoon = shows.map',
  '    const comingSoon = shows.map'
);

// End of calculations:
app = app.replace(
  '  const activeUpcoming = comingSoon.filter(s => s.daysUntil <= 14);',
  '    const activeUpcoming = comingSoon.filter(s => s.daysUntil <= 14);\n    return { upNext: activeUpNext, comingSoon: activeUpcoming };\n  }, [shows, episodesMap]);'
);
// replace activeUpNext with activeUpNext in the above because it maps to it. Let's be careful.
// Wait, I will just rewrite it to properly use React.useMemo.
