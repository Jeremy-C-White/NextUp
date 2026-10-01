import { UserShow } from "../types";
import { getTMDBExternalIds } from "./tmdb";
import { getShow } from "./tvmaze";

const PLEX_TV_THEME_BASE_URL = "https://tvthemes.plexapp.com";
const THEME_MUSIC_ENABLED_KEY = "NEXTUP_THEME_MUSIC_ENABLED";
const THEME_PREVIEWS_ENABLED_KEY = "NEXTUP_THEME_PREVIEWS_ENABLED";
const tvdbLookupCache = new Map<string, Promise<number | null>>();
const unavailableThemeUrls = new Set<string>();

function normalizeTvdbId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function getPlexTvThemeUrl(tvdbId: unknown): string | null {
  const normalizedId = normalizeTvdbId(tvdbId);
  return normalizedId ? `${PLEX_TV_THEME_BASE_URL}/${normalizedId}.mp3` : null;
}

export function readThemeMusicEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(THEME_MUSIC_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveThemeMusicEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_MUSIC_ENABLED_KEY, String(enabled));
  } catch {
    // Theme music remains usable for this session when storage is unavailable.
  }
}

/** ThemerrDB-guided Deezer previews for movies and shows Plex does not cover. */
export function readThemePreviewsEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(THEME_PREVIEWS_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveThemePreviewsEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_PREVIEWS_ENABLED_KEY, String(enabled));
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }
}

export async function resolveTvdbIdForTheme(show: UserShow): Promise<number | null> {
  if (show.isMovie) return null;

  const storedId = normalizeTvdbId(show.thetvdbId);
  if (storedId) return storedId;

  const cacheKey = `${show.id}:${show.tvmazeId || ""}:${show._tmdbId || ""}`;
  const existingLookup = tvdbLookupCache.get(cacheKey);
  if (existingLookup) return existingLookup;

  const lookup = (async () => {
    const tvmazeId = normalizeTvdbId(show.tvmazeId);
    if (tvmazeId) {
      try {
        const tvmazeShow = await getShow(tvmazeId);
        const tvdbId = normalizeTvdbId(tvmazeShow.externals?.thetvdb);
        if (tvdbId) return tvdbId;
      } catch {
        // Fall through to TMDB when TVMaze is temporarily unavailable.
      }
    }

    const tmdbId = normalizeTvdbId(show._tmdbId);
    if (tmdbId) {
      try {
        const externalIds = await getTMDBExternalIds(tmdbId, false);
        return normalizeTvdbId(externalIds.thetvdb);
      } catch {
        return null;
      }
    }

    return null;
  })();

  tvdbLookupCache.set(cacheKey, lookup);
  return lookup;
}

export async function resolveTvThemeUrl(show: UserShow): Promise<string | null> {
  const tvdbId = await resolveTvdbIdForTheme(show);
  const url = getPlexTvThemeUrl(tvdbId);
  return url && !unavailableThemeUrls.has(url) ? url : null;
}

export function markTvThemeUnavailable(url: string): void {
  if (url) unavailableThemeUrls.add(url);
}

export function clearTvThemeRuntimeCache(): void {
  tvdbLookupCache.clear();
  unavailableThemeUrls.clear();
}
