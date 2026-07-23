import { Show, Episode } from "../types";
import { getTMDBExternalIds } from "./tmdb";

const BASE_URL = "https://api.tvmaze.com";

function getCached<T>(key: string): T | null {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  try {
    const { data, expiry } = JSON.parse(cached);
    if (Date.now() > expiry) return null;
    return data as T;
  } catch {
    return null;
  }
}

function setCached<T>(key: string, data: T, ttlMinutes = 60) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000
    }));
  } catch (e: any) {
    console.warn('Cache write failed (quota exceeded?)', e);
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('tmdb_') || k.startsWith('tvm_') || k.startsWith('search_') || k.startsWith('tvmaze_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      try {
        localStorage.setItem(key, JSON.stringify({
          data,
          expiry: Date.now() + ttlMinutes * 60 * 1000
        }));
      } catch (retryErr) {
        console.warn('Cache write failed after cleanup', retryErr);
      }
    }
  }
}

export async function searchShows(query: string, signal?: AbortSignal): Promise<Show[]> {
  const cacheKey = `tvmaze_search_${query}`;
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  const res = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error("Failed to search shows");
  const data = await res.json();
  const shows = data.map((item: any) => item.show);
  setCached(cacheKey, shows, 360); // 6 hours
  return shows;
}

export async function getTrendingShows(): Promise<Show[]> {
  const cacheKey = 'tvmaze_trending';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const date = new Date().toISOString().split('T')[0];
  const res = await fetch(`${BASE_URL}/schedule/web?date=${date}`);
  if (!res.ok) return [];
  const data = await res.json();
  
  const uniqueShows = new Map<number, Show>();
  data.forEach((item: any) => {
    const show = item._embedded?.show || item.show;
    if (show && show.language === 'English') {
      uniqueShows.set(show.id, show);
    }
  });

  const shows = Array.from(uniqueShows.values())
    .sort((a, b) => (b as any).weight - (a as any).weight)
    .slice(0, 10);
    
  setCached(cacheKey, shows);
  return shows;
}

export async function getPremieringSoon(): Promise<Show[]> {
  const cacheKey = 'tvmaze_premiering';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];
  const res = await fetch(`${BASE_URL}/schedule/web?date=${date}`);
  if (!res.ok) return [];
  const data = await res.json();
  
  const uniqueShows = new Map<number, Show>();
  data.forEach((item: any) => {
    const show = item._embedded?.show || item.show;
    if (show && show.language === 'English') {
      uniqueShows.set(show.id, show);
    }
  });

  const shows = Array.from(uniqueShows.values())
    .sort((a, b) => (b as any).weight - (a as any).weight)
    .slice(0, 10);
    
  setCached(cacheKey, shows);
  return shows;
}

export async function getHiddenGems(): Promise<Show[]> {
  const cacheKey = 'tvmaze_gems';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/shows?page=0`);
  if (!res.ok) return [];
  const data = await res.json();
  
  const shows = data
    .filter((show: any) => show.rating?.average && show.rating.average >= 7.5 && show.weight < 90 && show.language === 'English')
    .sort((a: any, b: any) => b.rating.average - a.rating.average)
    .slice(0, 10);
    
  setCached(cacheKey, shows);
  return shows;
}

export async function getForYou(): Promise<Show[]> {
  const cacheKey = 'tvmaze_foryou';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/shows?page=1`);
  if (!res.ok) return [];
  const data = await res.json();
  
  const shows = data
    .filter((show: any) => show.language === 'English')
    .sort((a: any, b: any) => b.weight - a.weight)
    .slice(0, 10);
    
  setCached(cacheKey, shows);
  return shows;
}

export async function getTrendingTVMaze(): Promise<Show[]> {
  const cacheKey = 'tvmaze_trending_fallback';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/shows?page=0`);
  if (!res.ok) return [];
  const data = await res.json();
  
  const shows = data
    .filter((show: any) => show.language === 'English')
    .sort((a: any, b: any) => b.weight - a.weight)
    .slice(0, 10);
    
  setCached(cacheKey, shows);
  return shows;
}

export async function getShow(id: number): Promise<Show> {
  const res = await fetch(`${BASE_URL}/shows/${id}`);
  if (!res.ok) throw new Error("Failed to fetch show");
  return res.json();
}

export async function getEpisodes(showId: number, retries = 3): Promise<Episode[]> {
  const cacheKey = `tvmaze_episodes_${showId}`;
  const cached = getCached<Episode[]>(cacheKey);
  if (cached) return cached;

  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${BASE_URL}/shows/${showId}/episodes?specials=1`);
    if (res.ok) {
      const data = await res.json();
      setCached(cacheKey, data, 1440); // 24 hours
      return data;
    }
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Linear backoff
      continue;
    }
    throw new Error("Failed to fetch episodes");
  }
  throw new Error("Failed to fetch episodes after retries");
}

export async function resolveTVMazeShow(show: Show): Promise<Show> {
  if (show.id > 0) return show; // Already a TVMaze show
  
  let imdbId = show.externals?.imdb;
  let thetvdbId = show.externals?.thetvdb;
  
  if (!imdbId && show._tmdbId) {
    try {
      const ext = await getTMDBExternalIds(show._tmdbId, !!show.isMovie);
      imdbId = ext.imdb;
      thetvdbId = ext.thetvdb;
    } catch (e) {
      console.error("Failed to resolve TMDB external IDs during lookup", e);
    }
  }
  
  if (imdbId) {
    const res = await fetch(`${BASE_URL}/lookup/shows?imdb=${imdbId}`);
    if (res.ok) return res.json();
  }
  
  if (thetvdbId) {
    const res = await fetch(`${BASE_URL}/lookup/shows?thetvdb=${thetvdbId}`);
    if (res.ok) return res.json();
  }
  
  // Fallback to name search
  const res = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(show.name)}`);
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
  
  throw new Error("Could not confidently match this show on TVMaze - try searching for it manually.");
}
