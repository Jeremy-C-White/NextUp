import { UserShow } from "../types";
import { fetchTMDB } from "./tmdb";
import { isWebOSTV, requestWebOSService } from "./webos";

/**
 * Title logos: the official logo art for a show or movie (from TMDB), shown in
 * the Next Up hero and on the "Preparing to play" screen instead of plain text.
 * Results are cached per library title so the logo is ready the moment a title
 * is browsed to. When a title has no logo, the text title stays.
 */

export interface TmdbLogoImage {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
  width?: number;
  height?: number;
  aspect_ratio?: number;
}

/** "dark" logos are shown in white so they stay readable on the dark hero. */
export type LogoTone = "light" | "dark" | "unknown";

export interface TitleLogo {
  url: string;
  tone: LogoTone;
  aspectRatio: number;
}

interface CachedLogoEntry {
  /** Logo URL, or null when the title has no usable logo. */
  u: string | null;
  /** Saved at (ms since epoch). */
  t: number;
  tone?: LogoTone;
  ar?: number;
  /** How long this answer is kept, when not the default. */
  ttl?: number;
}

export interface LogoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const TITLE_LOGO_CACHE_KEY = "nextup_title_logos_v1";
const FOUND_TTL_MS = 21 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 3 * 24 * 60 * 60 * 1000;
// A logo whose colours could not be checked is not shown (a black logo would
// vanish on the dark hero); the text title is used and the check runs again.
export const UNREADABLE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const LOGO_IMAGE_SIZE = "w500";
const PREFETCH_CONCURRENCY = 2;

const IN_FLIGHT = new Map<string, Promise<TitleLogo | null>>();

function defaultStorage(): LogoStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function languageRank(language: string | null | undefined, preferred: string): number {
  if (language === preferred) return 0;
  if (language === null || language === undefined || language === "" || language === "xx") return 1;
  return -1;
}

/**
 * Pick the best logo: the viewer's language first (then language-free logos),
 * PNG before SVG, then the community's highest-rated, most-voted, sharpest.
 */
export function pickBestTitleLogo(logos: unknown, preferredLanguage = "en"): TmdbLogoImage | null {
  if (!Array.isArray(logos)) return null;
  const usable = logos.filter((logo): logo is TmdbLogoImage => {
    if (!logo || typeof logo !== "object") return false;
    const filePath = (logo as TmdbLogoImage).file_path;
    if (typeof filePath !== "string" || !/^\/[\w.-]+\.(png|svg)$/i.test(filePath)) return false;
    return languageRank((logo as TmdbLogoImage).iso_639_1, preferredLanguage) >= 0;
  });
  if (!usable.length) return null;

  const score = (logo: TmdbLogoImage) => [
    languageRank(logo.iso_639_1, preferredLanguage),
    /\.png$/i.test(logo.file_path) ? 0 : 1,
    -(Number(logo.vote_average) || 0),
    -(Number(logo.vote_count) || 0),
    -(Number(logo.width) || 0)
  ];

  return usable.slice().sort((a, b) => {
    const left = score(a);
    const right = score(b);
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
  })[0];
}

export function buildTitleLogoUrl(filePath: string): string {
  return `https://image.tmdb.org/t/p/${LOGO_IMAGE_SIZE}${filePath}`;
}

/**
 * Decide whether a logo is dark from its RGBA pixels. Only visible pixels
 * count, weighted by their opacity. Brightness is each pixel's strongest
 * colour channel, so saturated colours (a red or blue logo) keep their colour;
 * only black, grey-black and very deep logos count as "dark".
 */
export function classifyLogoTone(pixels: ArrayLike<number>): LogoTone {
  let weight = 0;
  let brightnessTotal = 0;
  let brightWeight = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.25) continue;
    const brightness = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) / 255;
    weight += alpha;
    brightnessTotal += brightness * alpha;
    if (brightness > 0.6) brightWeight += alpha;
  }
  if (weight < 12) return "unknown";
  const averageBrightness = brightnessTotal / weight;
  const brightShare = brightWeight / weight;
  return averageBrightness < 0.35 && brightShare < 0.15 ? "dark" : "light";
}

// The hero reads the cache on every render, so the parsed map is kept in
// memory and only written back to storage when it changes.
let memoryCache: { storage: LogoStorage; data: Record<string, CachedLogoEntry> } | null = null;

export function resetTitleLogoMemory() {
  memoryCache = null;
  IN_FLIGHT.clear();
}

function readCache(storage: LogoStorage | null): Record<string, CachedLogoEntry> {
  if (!storage) return {};
  if (memoryCache?.storage === storage) return memoryCache.data;
  let data: Record<string, CachedLogoEntry> = {};
  try {
    const parsed = JSON.parse(storage.getItem(TITLE_LOGO_CACHE_KEY) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
  } catch {
    data = {};
  }
  memoryCache = { storage, data };
  return data;
}

function writeCacheEntry(storage: LogoStorage | null, showId: string, entry: CachedLogoEntry) {
  if (!storage) return;
  const cache = readCache(storage);
  cache[showId] = entry;
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys
      .sort((a, b) => (cache[a]?.t || 0) - (cache[b]?.t || 0))
      .slice(0, keys.length - MAX_CACHE_ENTRIES)
      .forEach(key => { delete cache[key]; });
  }
  try {
    storage.setItem(TITLE_LOGO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Logos are optional polish; the text title remains.
  }
}

/**
 * Synchronous cache read used while rendering.
 * Returns the logo, null when the title is known to have none, or undefined
 * when it has not been looked up yet (or the saved answer has expired).
 */
export function readCachedTitleLogo(
  showId: string | undefined,
  storage: LogoStorage | null = defaultStorage(),
  now = Date.now()
): TitleLogo | null | undefined {
  if (!showId) return undefined;
  const entry = readCache(storage)[showId];
  if (!entry || typeof entry.t !== "number") return undefined;
  const ttl = typeof entry.ttl === "number" && entry.ttl > 0
    ? entry.ttl
    : entry.u ? FOUND_TTL_MS : MISSING_TTL_MS;
  if (now - entry.t > ttl) return undefined;
  if (!entry.u) return null;
  // Only logos whose colours were checked are shown.
  if (entry.tone !== "dark" && entry.tone !== "light") return undefined;
  return {
    url: entry.u,
    tone: entry.tone,
    aspectRatio: Number(entry.ar) > 0 ? Number(entry.ar) : 4
  };
}

export function saveTitleLogo(
  showId: string,
  logo: TitleLogo | null,
  storage: LogoStorage | null = defaultStorage(),
  now = Date.now(),
  ttlMs?: number
) {
  const entry: CachedLogoEntry = logo
    ? { u: logo.url, t: now, tone: logo.tone, ar: Math.round(logo.aspectRatio * 1000) / 1000 }
    : { u: null, t: now };
  if (ttlMs) entry.ttl = ttlMs;
  writeCacheEntry(storage, showId, entry);
}

/**
 * TMDB id for a library title, or null when TMDB has no match. Network errors
 * are thrown (not turned into "no match"), so they are never cached as
 * "this title has no logo".
 */
export async function resolveLogoTmdbId(show: UserShow): Promise<number | null> {
  const stored = Number(show._tmdbId);
  if (Number.isSafeInteger(stored) && stored > 0) return stored;

  const numericId = Number(show.id);
  if (show.isMovie && Number.isSafeInteger(numericId) && numericId < -1_000_000_000) {
    return -numericId - 1_000_000_000;
  }
  if (!show.isMovie && Number.isSafeInteger(numericId) && numericId < 0 && numericId > -1_000_000_000) {
    return -numericId;
  }

  const firstResultId = (data: any) => {
    const results = show.isMovie ? data?.movie_results : data?.tv_results;
    const tmdbId = Number(results?.[0]?.id);
    return Number.isSafeInteger(tmdbId) && tmdbId > 0 ? tmdbId : null;
  };

  if (show.imdbId && /^tt\d+$/.test(show.imdbId)) {
    const fromImdb = firstResultId(await fetchTMDB(`/find/${show.imdbId}`, { external_source: "imdb_id" }));
    if (fromImdb) return fromImdb;
  }

  if (!show.isMovie && Number(show.thetvdbId) > 0) {
    const fromTvdb = firstResultId(await fetchTMDB(`/find/${Number(show.thetvdbId)}`, { external_source: "tvdb_id" }));
    if (fromTvdb) return fromTvdb;
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed"));
    image.src = src;
  });
}

/** Readable (same-origin) copy of the logo image, or null. */
async function readableLogoSource(url: string): Promise<{ src: string; revoke?: () => void } | null> {
  if (isWebOSTV()) {
    const payload = await requestWebOSService("fetchImage", { url });
    const base64 = typeof payload.base64 === "string" ? payload.base64 : "";
    const contentType = typeof payload.contentType === "string" ? payload.contentType : "";
    if (!payload.ok || !base64 || !contentType.startsWith("image/")) return null;
    return { src: `data:${contentType};base64,${base64}` };
  }
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) return null;
  const objectUrl = URL.createObjectURL(await response.blob());
  return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}

/** Best-effort tone check; "unknown" whenever the pixels cannot be read. */
export async function detectLogoTone(url: string): Promise<LogoTone> {
  if (typeof document === "undefined" || typeof Image === "undefined") return "unknown";
  let source: { src: string; revoke?: () => void } | null = null;
  try {
    source = await readableLogoSource(url);
    if (!source) return "unknown";
    const image = await loadImage(source.src);
    const naturalWidth = image.naturalWidth || 300;
    const naturalHeight = image.naturalHeight || 100;
    const width = Math.max(8, Math.min(96, naturalWidth));
    const height = Math.max(4, Math.round(width * naturalHeight / naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "unknown";
    context.drawImage(image, 0, 0, width, height);
    return classifyLogoTone(context.getImageData(0, 0, width, height).data);
  } catch {
    return "unknown";
  } finally {
    source?.revoke?.();
  }
}

export interface TitleLogoOptions {
  /** Replaces the pixel check (used by tests). */
  detectTone?: (url: string) => Promise<LogoTone>;
}

async function lookUpTitleLogo(show: UserShow, options: TitleLogoOptions): Promise<TitleLogo | null> {
  const tmdbId = await resolveLogoTmdbId(show);
  if (!tmdbId) return null;
  const images = await fetchTMDB(`/${show.isMovie ? "movie" : "tv"}/${tmdbId}/images`, {
    include_image_language: "en,null"
  });
  const best = pickBestTitleLogo(images?.logos);
  if (!best) return null;
  const url = buildTitleLogoUrl(best.file_path);
  const aspectRatio = Number(best.aspect_ratio) > 0
    ? Number(best.aspect_ratio)
    : Number(best.width) > 0 && Number(best.height) > 0 ? Number(best.width) / Number(best.height) : 4;
  return { url, tone: await (options.detectTone || detectLogoTone)(url), aspectRatio };
}

/**
 * Look up (and cache) a title's logo. Concurrent calls for the same title share
 * one lookup. Network failures are not cached, so the next visit tries again.
 * A logo whose colours could not be checked is not used for now.
 */
export function resolveTitleLogo(show: UserShow, options: TitleLogoOptions = {}): Promise<TitleLogo | null> {
  const cached = readCachedTitleLogo(show.id);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = IN_FLIGHT.get(show.id);
  if (existing) return existing;

  const lookup = lookUpTitleLogo(show, options)
    .then(logo => {
      if (logo && logo.tone === "unknown") {
        saveTitleLogo(show.id, null, defaultStorage(), Date.now(), UNREADABLE_TTL_MS);
        return null;
      }
      saveTitleLogo(show.id, logo);
      return logo;
    })
    .finally(() => {
      IN_FLIGHT.delete(show.id);
    });
  IN_FLIGHT.set(show.id, lookup);
  return lookup;
}

/** Warm the logo cache for a whole queue, a couple of titles at a time. */
export async function prefetchTitleLogos(
  shows: UserShow[],
  signal?: AbortSignal,
  options: TitleLogoOptions = {}
): Promise<void> {
  const pending = shows.filter((show, index) =>
    shows.findIndex(other => other.id === show.id) === index
    && readCachedTitleLogo(show.id) === undefined
  );
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length && !signal?.aborted) {
      const show = pending[cursor];
      cursor += 1;
      try {
        await resolveTitleLogo(show, options);
      } catch {
        // One failed lookup never blocks the rest of the queue.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, pending.length) }, worker));
}

