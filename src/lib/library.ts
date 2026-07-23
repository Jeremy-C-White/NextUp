import { collection, doc, setDoc, deleteDoc, getDocs, deleteField } from "firebase/firestore";
import { db, auth } from "../firebase";
import { UserShow, UserEpisode, Show, Episode } from "../types";
import { getEpisodes } from "./tvmaze";

export function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefined(entryValue)]);
    return Object.fromEntries(cleanedEntries) as T;
  }
  return value;
}

export async function addShowToLibrary(show: Show, caughtUp: boolean = false): Promise<{ userShow: UserShow, userEpisodes: UserEpisode[] }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showId = show.id;
  
  let watchedEpisodes = {};
  if (caughtUp) {
    let episodes = [];
    if (show.isMovie || show.isMovie) {
      episodes = [{ id: "movie_" + showId, airstamp: new Date().toISOString() }];
    } else {
      episodes = await getEpisodes(showId);
    }
    watchedEpisodes = episodes.filter(ep => ep.airstamp && new Date(ep.airstamp) < new Date()).reduce((acc, ep) => ({ ...acc, [ep.id.toString()]: Date.now() }), {});
  }

  const provider = show.webChannel?.name || show.network?.name || "";

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
    watchedEpisodes,
    lastRefreshed: Date.now(),
    isMovie: !!show.isMovie || !!show.isMovie,
    premiered: show.premiered || "",
    rating: show.rating || {},
    vote_average: show.vote_average || 0,
  };

  const tmdbId = show._tmdbId || (show.isMovie && showId < 0 ? (-showId - 1000000000) : undefined);
  if (tmdbId !== undefined) {
    userShow._tmdbId = tmdbId;
  }

  const safeShowData = removeUndefined(userShow);
  const showRef = doc(db, `users/${user.uid}/shows/${showId}`);
  await setDoc(showRef, safeShowData, { merge: true });
  
  return { userShow, userEpisodes: [] };
}

export async function removeShowFromLibrary(showId: number): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showRef = doc(db, `users/${user.uid}/shows/${showId}`);
  await deleteDoc(showRef);
}


export async function getShowEpisodes(showId: number, watchedEpisodes: Record<string, number | null> = {}, isMovie?: boolean, premiered?: string): Promise<UserEpisode[]> {
  if (isMovie) {
    let airstamp = "";
    if (premiered) {
      try {
        const parsed = new Date(premiered);
        if (!isNaN(parsed.getTime())) {
          airstamp = parsed.toISOString();
        }
      } catch (e) {}
    }
    if (!airstamp) {
      airstamp = new Date().toISOString();
    }
    return [{
      id: "movie_" + showId,
      showId,
      season: 1,
      number: 1,
      name: "Movie",
      airdate: premiered || "",
      airstamp,
      imageUrl: "",
      summary: "",
      watched: !!watchedEpisodes["movie_" + showId],
      watchedAt: watchedEpisodes["movie_" + showId] || undefined
    }];
  }
  let episodes = [];
  if (false) {
    episodes = [{ id: "movie_" + showId, airstamp: new Date().toISOString() }];
  } else {
    episodes = await getEpisodes(showId);
  }
  return episodes.map(ep => ({
    id: ep.id.toString(),
    showId,
    season: ep.season,
    number: ep.number,
    type: ep.type,
    runtime: ep.runtime,
    name: ep.name,
    airdate: ep.airdate,
    airstamp: ep.airstamp,
    imageUrl: ep.image?.medium || ep.image?.original || "",
    summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : "",
    watched: !!watchedEpisodes[ep.id.toString()],
    watchedAt: watchedEpisodes[ep.id.toString()] || undefined
  })).sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });
}

export async function markEpisodeWatched(showId: number, episodeId: string, watched: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const showRef = doc(db, `users/${user.uid}/shows/${showId}`);
  await setDoc(showRef, {
    watchedEpisodes: {
      [episodeId]: watched ? Date.now() : deleteField()
    }
  }, { merge: true });
}

export async function markEpisodesWatchedBatch(showId: number, episodesToMark: string[], watched: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const updates: Record<string, any> = {};
  for (const epId of episodesToMark) {
    updates[epId] = watched ? Date.now() : deleteField();
  }

  const showRef = doc(db, `users/${user.uid}/shows/${showId}`);
  await setDoc(showRef, {
    watchedEpisodes: updates
  }, { merge: true });
}
