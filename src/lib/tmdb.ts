import { Show } from "../types";
import { getCached as apiGetCached, setCached as apiSetCached } from "./apiCache";

function getCached<T>(key: string) { return apiGetCached<T>("tmdb", "legacy", [key]); }
function setCached<T>(key: string, data: T, ttl = 60) { apiSetCached<T>("tmdb", "legacy", [key], data, ttl); }
import { fetchJson } from "./httpClient";

const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = (import.meta as any).env.VITE_TMDB_API_KEY || (import.meta as any).env.TMDB_API_KEY;
export async function fetchTMDB(endpoint: string, params: Record<string, string> = {}, signal?: AbortSignal) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  
  return fetchJson<any>(url.toString(), { signal, concurrencyGroup: "tmdb", timeoutMs: 15000, retries: 2 });
  
  
}

function enrichTMDBShow(tmdbShow: any): Show {
  return {
    id: -tmdbShow.id, // Negative indicates TMDB sourced
    name: tmdbShow.name || tmdbShow.original_name,
    image: {
      medium: tmdbShow.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbShow.poster_path}` : "",
      original: tmdbShow.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbShow.backdrop_path}` : ""
    },
    summary: tmdbShow.overview,
    premiered: tmdbShow.first_air_date,
    vote_average: tmdbShow.vote_average,
    _tmdbId: tmdbShow.id
  } as any;
}


export async function getTrendingMoviesTMDB(): Promise<Show[]> {
  const cacheKey = 'tmdb_trending_movies_streaming';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const today = new Date().toISOString().split('T')[0];
  
  const data = await fetchTMDB('/discover/movie', {
    'sort_by': 'popularity.desc',
    'with_release_type': '4|5', // Digital | Physical
    'release_date.lte': today,
    'vote_count.gte': '50',
    'watch_region': 'US'
  });
  
  const shows = data.results.slice(0, 10).map(enrichTMDBMovie);
  setCached(cacheKey, shows);
  return shows;
}

export async function getTrendingTMDB(): Promise<Show[]> {
  const cacheKey = 'tmdb_trending';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchTMDB('/trending/tv/day');
  const shows = data.results.slice(0, 10).map(enrichTMDBShow);
  setCached(cacheKey, shows);
  return shows;
}

export async function getHiddenGemsTMDB(): Promise<Show[]> {
  const cacheKey = 'tmdb_hidden_gems';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchTMDB('/discover/tv', {
    'vote_count.gte': '100',
    'vote_average.gte': '7.5',
    'popularity.lte': '40', // Lower popularity for hidden gems
    'with_original_language': 'en',
    'sort_by': 'vote_average.desc',
  });
  
  const shows = data.results.slice(0, 10).map(enrichTMDBShow);
  setCached(cacheKey, shows);
  return shows;
}

export async function getForYouTMDB(): Promise<Show[]> {
  const cacheKey = 'tmdb_foryou';
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchTMDB('/discover/tv', {
    'vote_count.gte': '500',
    'with_original_language': 'en',
    'sort_by': 'popularity.desc',
  });
  
  const shows = data.results.slice(0, 10).map(enrichTMDBShow);
  setCached(cacheKey, shows);
  return shows;
}

export async function getRecommendationsTMDB(seeds: {id: number, isMovie: boolean}[]): Promise<Show[]> {
  if (!seeds.length) return [];
  const cacheKey = `tmdb_recs_${seeds.map(s => `${s.id}_${s.isMovie}`).join('_')}`;
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;

  const allRecs = new Map<string, any>();
  const isMovieMap = new Map<string, boolean>();
  // fetch recommendations for up to 3 recent shows
  const targets = seeds.slice(0, 3);
  
  await Promise.all(targets.map(async ({id, isMovie}) => {
    try {
      const endpoint = isMovie ? `/movie/${id}/recommendations` : `/tv/${id}/recommendations`;
      const data = await fetchTMDB(endpoint);
      data.results.forEach((item: any) => {
        const itemIsMovie = item.media_type === "movie" || isMovie;
        const key = `${itemIsMovie ? 'movie' : 'tv'}:${item.id}`;
        if (!allRecs.has(key)) {
          allRecs.set(key, item);
          isMovieMap.set(key, itemIsMovie);
        }
      });
    } catch (e) {
      console.warn("Failed fetching recs for", id, e);
    }
  }));

  const excludedKeys = seeds.map(s => `${s.isMovie ? 'movie' : 'tv'}:${s.id}`);
  const dismissedRecsKeys = JSON.parse(localStorage.getItem('nextup_dismissed_recs') || '[]');
  
  const sortedKeys = Array.from(allRecs.keys())
    .sort((a, b) => allRecs.get(b).popularity - allRecs.get(a).popularity)
    .filter(key => !excludedKeys.includes(key) && !dismissedRecsKeys.includes(key))
    .slice(0, 10);

  const shows = sortedKeys.map(key => {
    const item = allRecs.get(key);
    return isMovieMap.get(key) ? enrichTMDBMovie(item) : enrichTMDBShow(item);
  });
  
  setCached(cacheKey, shows);
  return shows;
}

export async function getTMDBIdFromIMDB(imdbId: string, isMovie = false): Promise<number | null> {
  if (!imdbId) return null;
  const mediaType = isMovie ? "movie" : "tv";
  const cacheKey = `tmdb_id_v2_${mediaType}_${imdbId}`;
  const cached = getCached<number>(cacheKey);
  if (cached) return cached;
  
  try {
    const data = await fetchTMDB(`/find/${imdbId}`, { external_source: 'imdb_id' });
    const results = isMovie ? data.movie_results : data.tv_results;
    const tmdbId = results?.[0]?.id;
    if (tmdbId) {
      setCached(cacheKey, tmdbId, 24 * 60 * 7); // Cache for a week
      return tmdbId;
    }
  } catch (e) {
    console.error("Failed to lookup TMDB ID from IMDB:", e);
  }
  return null;
}

export async function getWatchProviders(tmdbId: number, isMovie = false): Promise<any[]> {
  const mediaType = isMovie ? "movie" : "tv";
  const cacheKey = `tmdb_providers_v2_${mediaType}_${tmdbId}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  try {
    const data = await fetchTMDB(`/${mediaType}/${tmdbId}/watch/providers`);
    // 'US' is the country code, we could make this dynamic or default to US
    const usProviders = data.results?.US;
    if (usProviders) {
      // combine flatrate, free, ads
      const providers = [...(usProviders.flatrate || []), ...(usProviders.free || []), ...(usProviders.ads || [])];
      // deduplicate
      const unique = Array.from(new Map(providers.map(p => [p.provider_id, p])).values());
      setCached(cacheKey, unique, 24 * 60); // 24 hours
      return unique;
    }
  } catch (e) {
    console.error("Failed to fetch watch providers", e);
  }
  return [];
}

export async function getTopShowsByNetwork(networkId: number): Promise<Show[]> {
  const cacheKey = `tmdb_network_combined_${networkId}`;
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  try {
    const tvData = await fetchTMDB('/discover/tv', {
      with_networks: networkId.toString(),
      watch_region: 'US',
      sort_by: 'popularity.desc',
      'vote_count.gte': '100',
      without_genres: '10763,10767' // Exclude news and talk
    });
    const tvShows = tvData.results.slice(0, 10).map(enrichTMDBShow);

    const providerMap: Record<number, number> = {
      213: 8,    // Netflix
      2552: 350, // Apple TV+
      1024: 9,   // Amazon Prime Video
      2739: 337, // Disney+
      4330: 531, // Paramount+
      3186: 1899,// Max
      453: 15    // Hulu
    };

    const providerId = providerMap[networkId];
    let movies: Show[] = [];
    if (providerId) {
      try {
        const movieData = await fetchTMDB('/discover/movie', {
          with_watch_providers: providerId.toString(),
          watch_region: 'US',
          sort_by: 'popularity.desc',
          'vote_count.gte': '100'
        });
        movies = movieData.results.slice(0, 10).map(enrichTMDBMovie);
      } catch (me) {
        console.error("Failed to fetch movies for provider " + providerId, me);
      }
    }

    const combined: Show[] = [];
    const maxLength = Math.max(tvShows.length, movies.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < tvShows.length) combined.push(tvShows[i]);
      if (i < movies.length) combined.push(movies[i]);
    }

    const finalShows = combined.slice(0, 15);
    setCached(cacheKey, finalShows);
    return finalShows;
  } catch (e) {
    console.error("Failed to fetch network combined list", e);
    return [];
  }
}

export async function searchMultiTMDB(query: string, signal?: AbortSignal): Promise<Show[]> {
  const cacheKey = `tmdb_search_${query}`;
  const cached = getCached<Show[]>(cacheKey);
  if (cached) return cached;
  
  const data = await fetchTMDB('/search/multi', { query, include_adult: 'false' }, signal);
  const results = data.results.filter((r: any) => r.media_type === 'tv' || r.media_type === 'movie').slice(0, 10);
  
  const shows = results.map((r: any) => {
    if (r.media_type === 'tv') {
      return enrichTMDBShow(r);
    } else {
      return enrichTMDBMovie(r);
    }
  });
  setCached(cacheKey, shows, 60);
  return shows;
}

export async function getTMDBExternalIds(tmdbId: number, isMovie: boolean): Promise<{ imdb?: string, thetvdb?: number }> {
  const mediaType = isMovie ? "movie" : "tv";
  const cacheKey = `tmdb_ext_v2_${mediaType}_${tmdbId}`;
  const cached = getCached<{ imdb?: string, thetvdb?: number }>(cacheKey);
  if (cached) return cached;
  
  try {
    const endpoint = isMovie ? `/movie/${tmdbId}/external_ids` : `/tv/${tmdbId}/external_ids`;
    const data = await fetchTMDB(endpoint);
    const res = {
      imdb: data.imdb_id || undefined,
      thetvdb: data.tvdb_id || undefined
    };
    setCached(cacheKey, res, 24 * 60 * 7); // cache for a week
    return res;
  } catch (e) {
    console.error("Failed to fetch TMDB external IDs", e);
    return {};
  }
}

function enrichTMDBMovie(tmdbMovie: any): Show {
  return {
    id: -tmdbMovie.id - 1000000000, // Make it very negative to distinguish movie from TV
    name: tmdbMovie.title || tmdbMovie.original_title,
    image: {
      medium: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbMovie.poster_path}` : "",
      original: tmdbMovie.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbMovie.backdrop_path}` : ""
    },
    summary: tmdbMovie.overview,
    premiered: tmdbMovie.release_date,
    status: 'Ended', // Movies are ended
    vote_average: tmdbMovie.vote_average,
    _tmdbId: tmdbMovie.id,
    isMovie: true
  } as any;
}
