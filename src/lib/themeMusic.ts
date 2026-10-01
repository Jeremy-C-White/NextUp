import { UserShow } from "../types";
import { getTMDBIdFromIMDB } from "./tmdb";
import { fetchThroughProxy } from "./webos";

/**
 * Theme music fallback for titles Plex's TV theme library does not cover
 * (every movie, and shows Plex has no theme for):
 *
 *   1. ThemerrDB (community list of the correct theme per title, keyed by TMDB
 *      id) says WHICH song is the theme. It only stores a YouTube link, so we
 *      read that video's title through YouTube oEmbed and never play YouTube.
 *   2. Deezer's public search API supplies a playable 30-second preview. The
 *      preview is streamed only, never stored (Deezer guidelines).
 *
 * Deezer preview URLs are signed and expire, so resolved tracks are cached in
 * memory for this session only; only a rejected track's numeric id is saved.
 */

const THEMERR_DB_BASE_URL = "https://app.lizardbyte.dev/ThemerrDB";
const YOUTUBE_OEMBED_URL = "https://www.youtube.com/oembed";
const DEEZER_SEARCH_URL = "https://api.deezer.com/search";
const REJECTED_THEMES_KEY = "nextup_theme_rejected_v1";
const MINIMUM_THEME_SCORE = 45;
const DEEZER_RESULT_LIMIT = 25;

export interface DeezerThemeTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  durationSeconds: number;
}

export interface ThemeSearchContext {
  mediaTitle: string;
  isMovie: boolean;
  /** Cleaned title of the ThemerrDB YouTube video, when one exists. */
  themeHint?: string | null;
}

export interface ResolvedFallbackTheme {
  track: DeezerThemeTrack;
  hintSource: "themerrdb" | "search";
  score: number;
}

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const COVER_OR_NOVELTY = /\b(?:cover|covers|karaoke|tribute|lullab(?:y|ies)|8[ -]?bit|remix|rendition|made famous|in the style of|parody|ringtone|kids|baby|music box|workout)\b/;
const SOUNDTRACK_ALBUM = /\b(?:soundtrack|original motion picture|original score|music from|ost|original television|original series|television series|series soundtrack|music of|score)\b/;
// Compilation acts that re-record TV and film themes.
const SOUNDALIKE_ARTIST = /\b(?:players|tv themes?|theme songs?|soundalikes?|sound alike|all stars|allstars|hit crew|movie sounds unlimited|tribute|karaoke|lullaby|piano guys covers)\b/;
const THEME_TRACK = /\b(?:main title|main titles|main theme|end title|end titles|opening|opening credits|prologue|overture|theme|title)\b/;

export function normalizeThemeText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "from", "to", "in", "on", "for", "by", "with"]);

function significantTokens(value: string): string[] {
  return normalizeThemeText(value).split(" ").filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function containsPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeThemeText(needle);
  if (!normalizedNeedle) return false;
  return ` ${normalizeThemeText(haystack)} `.includes(` ${normalizedNeedle} `);
}

/** Share of the hint's words that also appear in the candidate. */
function hintCoverage(hint: string, candidate: string): number {
  const hintTokens = new Set(significantTokens(hint));
  const candidateTokens = new Set(significantTokens(candidate));
  if (hintTokens.size === 0 || candidateTokens.size === 0) return 0;
  let shared = 0;
  hintTokens.forEach(token => { if (candidateTokens.has(token)) shared += 1; });
  return shared / hintTokens.size;
}

/** Strips YouTube-title noise so it can be used as a music search query. */
export function cleanThemeHint(rawTitle: string | null | undefined): string | null {
  let title = String(rawTitle || "");
  title = title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:[^)]*\b(?:official|video|audio|lyrics?|hd|hq|4k|1080p|720p|full|extended|version|visualizer|remaster(?:ed)?)\b[^)]*)\)/gi, " ")
    .replace(/\b(?:official\s+(?:music\s+)?(?:video|audio)|lyric\s+video|lyrics|full\s+song|hq|hd|4k)\b/gi, " ")
    .replace(/\s*[|\u2022]\s*.*$/, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-\u2013\u2014:\s]+|[-\u2013\u2014:\s]+$/g, "");
  return title.length >= 3 ? title : null;
}

export function buildThemerrDbUrl(isMovie: boolean, tmdbId: number): string | null {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  return `${THEMERR_DB_BASE_URL}/${isMovie ? "movies" : "tv_shows"}/themoviedb/${tmdbId}.json`;
}

export function parseThemerrYoutubeUrl(payload: unknown): string | null {
  const url = (payload as { youtube_theme_url?: unknown } | null)?.youtube_theme_url;
  if (typeof url !== "string") return null;
  return /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(url.trim()) ? url.trim() : null;
}

export function buildYoutubeOembedUrl(youtubeUrl: string): string {
  const url = new URL(YOUTUBE_OEMBED_URL);
  url.searchParams.set("url", youtubeUrl);
  url.searchParams.set("format", "json");
  return url.toString();
}

export function buildDeezerSearchUrl(query: string): string {
  const url = new URL(DEEZER_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(DEEZER_RESULT_LIMIT));
  return url.toString();
}

export function parseDeezerSearch(payload: unknown): DeezerThemeTrack[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const raw = item as {
      id?: unknown; title?: unknown; preview?: unknown; duration?: unknown;
      artist?: { name?: unknown }; album?: { title?: unknown };
    };
    const id = Number(raw.id);
    const previewUrl = typeof raw.preview === "string" ? raw.preview.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!Number.isSafeInteger(id) || id <= 0 || !title || !/^https:\/\//.test(previewUrl)) return [];
    return [{
      id,
      title,
      artist: typeof raw.artist?.name === "string" ? raw.artist.name.trim() : "",
      album: typeof raw.album?.title === "string" ? raw.album.title.trim() : "",
      previewUrl,
      durationSeconds: Number.isFinite(Number(raw.duration)) ? Number(raw.duration) : 0
    }];
  });
}

/**
 * Scores how likely a Deezer track is the title's real theme. A track must be
 * tied to the title (album or track name contains it, or it matches the
 * ThemerrDB hint); covers, karaoke and novelty versions are pushed out.
 */
export function scoreThemeTrack(track: DeezerThemeTrack, context: ThemeSearchContext, resultIndex = 0): number {
  const title = normalizeThemeText(track.title);
  const album = normalizeThemeText(track.album);
  const artist = normalizeThemeText(track.artist);
  const media = normalizeThemeText(context.mediaTitle);
  if (!media) return 0;

  const albumHasMedia = containsPhrase(album, media);
  const titleHasMedia = containsPhrase(title, media);
  const hintOverlap = context.themeHint ? hintCoverage(context.themeHint, `${track.title} ${track.artist}`) : 0;
  // A generic hint such as "Main Theme" could match any film, so only a
  // specific hint (three or more meaningful words) can vouch for a track alone.
  const hintIsSpecific = significantTokens(context.themeHint || "").length >= 3;
  const hintTiedToTitle = hintIsSpecific && hintOverlap >= 0.6;
  // The ThemerrDB video title usually names the performer ("The Rembrandts -
  // I'll Be There For You"); a matching artist separates the original from
  // re-recordings with the same song title.
  const artistInHint = Boolean(context.themeHint && artist && containsPhrase(context.themeHint, track.artist));

  if (!albumHasMedia && !titleHasMedia && !hintTiedToTitle) return 0;

  let score = 0;
  if (albumHasMedia) score += 35;
  if (titleHasMedia) score += 20;
  if (SOUNDTRACK_ALBUM.test(album)) score += 15;
  if (THEME_TRACK.test(title)) score += 15;
  // ThemerrDB is a curated pick, so a strong match to it is enough on its own.
  if (hintTiedToTitle) score += 50;
  else if (hintOverlap >= 0.34) score += 15;
  if (artistInHint) score += 10;
  if (COVER_OR_NOVELTY.test(title) || COVER_OR_NOVELTY.test(album) || COVER_OR_NOVELTY.test(artist)) score -= 60;
  if (SOUNDALIKE_ARTIST.test(artist)) score -= 60;
  // Deezer ranks by popularity; the first few results are usually originals.
  score += Math.max(0, 5 - resultIndex);
  if (track.durationSeconds > 0 && track.durationSeconds < 20) score -= 20;
  return score;
}

export function pickBestThemeTrack(
  tracks: DeezerThemeTrack[],
  context: ThemeSearchContext,
  rejectedTrackIds: ReadonlySet<number> = new Set()
): { track: DeezerThemeTrack; score: number } | null {
  let best: { track: DeezerThemeTrack; score: number } | null = null;
  const seen = new Set<number>();
  for (const [index, track] of tracks.entries()) {
    if (seen.has(track.id) || rejectedTrackIds.has(track.id)) continue;
    seen.add(track.id);
    const score = scoreThemeTrack(track, context, index);
    if (score >= MINIMUM_THEME_SCORE && (!best || score > best.score)) best = { track, score };
  }
  return best;
}

export function buildThemeSearchQueries(context: ThemeSearchContext): string[] {
  const queries: string[] = [];
  if (context.themeHint) queries.push(context.themeHint);
  queries.push(context.isMovie
    ? `${context.mediaTitle} soundtrack main title`
    : `${context.mediaTitle} theme`);
  queries.push(context.isMovie
    ? `${context.mediaTitle} original motion picture soundtrack`
    : `${context.mediaTitle} main title theme soundtrack`);
  return Array.from(new Set(queries.map(query => query.trim()).filter(Boolean)));
}

/** The TMDB id for a library title: stored, derived for movies, or looked up. */
export async function resolveThemeTmdbId(show: UserShow): Promise<number | null> {
  const stored = Number(show._tmdbId);
  if (Number.isSafeInteger(stored) && stored > 0) return stored;
  const numericId = Number(show.id);
  if (show.isMovie && Number.isSafeInteger(numericId) && numericId < -1_000_000_000) {
    return -numericId - 1_000_000_000;
  }
  if (show.imdbId && /^tt\d+$/.test(show.imdbId)) {
    try {
      return await getTMDBIdFromIMDB(show.imdbId, Boolean(show.isMovie));
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  const response = await fetchThroughProxy(url, signal);
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveThemerrHint(show: UserShow, signal?: AbortSignal): Promise<string | null> {
  const tmdbId = await resolveThemeTmdbId(show);
  const themerrUrl = tmdbId ? buildThemerrDbUrl(Boolean(show.isMovie), tmdbId) : null;
  if (!themerrUrl) return null;
  const youtubeUrl = parseThemerrYoutubeUrl(await fetchJson(themerrUrl, signal));
  if (!youtubeUrl) return null;
  const oembed = await fetchJson(buildYoutubeOembedUrl(youtubeUrl), signal) as { title?: unknown } | null;
  return cleanThemeHint(typeof oembed?.title === "string" ? oembed.title : null);
}

export function readRejectedThemeTrackIds(storage: ThemeStorage | null, showId: string): Set<number> {
  if (!storage) return new Set();
  try {
    const all = JSON.parse(storage.getItem(REJECTED_THEMES_KEY) || "{}") as Record<string, unknown>;
    const ids = all[showId];
    return new Set(Array.isArray(ids) ? ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : []);
  } catch {
    return new Set();
  }
}

export function rejectThemeTrack(storage: ThemeStorage | null, showId: string, trackId: number): void {
  if (!storage || !Number.isSafeInteger(trackId) || trackId <= 0) return;
  try {
    const all = JSON.parse(storage.getItem(REJECTED_THEMES_KEY) || "{}") as Record<string, number[]>;
    const ids = new Set(Array.isArray(all[showId]) ? all[showId] : []);
    ids.add(trackId);
    all[showId] = Array.from(ids).slice(-20);
    storage.setItem(REJECTED_THEMES_KEY, JSON.stringify(all));
  } catch {
    // Rejection is a convenience; music keeps working without storage.
  }
}

const fallbackThemeCache = new Map<string, Promise<ResolvedFallbackTheme | null>>();

function themeStorage(): ThemeStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Finds a Deezer preview for a title's theme, preferring the ThemerrDB pick.
 * Returns null when nothing clearly tied to the title is found (silence is
 * better than a random song).
 */
export function resolveFallbackTheme(show: UserShow, options: { refresh?: boolean } = {}): Promise<ResolvedFallbackTheme | null> {
  const rejected = readRejectedThemeTrackIds(themeStorage(), show.id);
  const cacheKey = `${show.id}:${Array.from(rejected).sort().join(",")}`;
  if (options.refresh) fallbackThemeCache.delete(cacheKey);
  const cached = fallbackThemeCache.get(cacheKey);
  if (cached) return cached;

  const lookup = (async (): Promise<ResolvedFallbackTheme | null> => {
    const mediaTitle = String(show.name || "").trim();
    if (!mediaTitle) return null;

    let themeHint: string | null = null;
    try {
      themeHint = await resolveThemerrHint(show);
    } catch {
      themeHint = null;
    }

    const context: ThemeSearchContext = { mediaTitle, isMovie: Boolean(show.isMovie), themeHint };
    for (const query of buildThemeSearchQueries(context)) {
      let tracks: DeezerThemeTrack[] = [];
      try {
        tracks = parseDeezerSearch(await fetchJson(buildDeezerSearchUrl(query)));
      } catch {
        tracks = [];
      }
      const best = pickBestThemeTrack(tracks, context, rejected);
      if (best) {
        return {
          track: best.track,
          score: best.score,
          hintSource: themeHint ? "themerrdb" : "search"
        };
      }
    }
    return null;
  })();

  fallbackThemeCache.set(cacheKey, lookup);
  lookup.catch(() => fallbackThemeCache.delete(cacheKey));
  return lookup;
}

export function forgetFallbackTheme(showId: string): void {
  Array.from(fallbackThemeCache.keys())
    .filter(key => key.startsWith(`${showId}:`))
    .forEach(key => fallbackThemeCache.delete(key));
}
