import { afterEach, describe, expect, test, vi } from "vitest";
import {
  clearTvThemeRuntimeCache,
  getPlexTvThemeUrl,
  readThemeMusicEnabled,
  readThemePreviewsEnabled,
  resolveTvThemeUrl,
  saveThemeMusicEnabled,
  saveThemePreviewsEnabled
} from "./tvThemes";

const originalLocalStorage = global.localStorage;

afterEach(() => {
  clearTvThemeRuntimeCache();
  global.localStorage = originalLocalStorage;
  vi.restoreAllMocks();
});

describe("TV theme music", () => {
  test("builds Plex's TVDB-based theme URL", () => {
    expect(getPlexTvThemeUrl(152831)).toBe("https://tvthemes.plexapp.com/152831.mp3");
    expect(getPlexTvThemeUrl(0)).toBeNull();
    expect(getPlexTvThemeUrl("not-an-id")).toBeNull();
  });

  test("uses a TVDB ID already stored on the library show", async () => {
    const url = await resolveTvThemeUrl({
      id: "adventure-time",
      name: "Adventure Time",
      tvmazeId: 0,
      thetvdbId: 152831
    } as any);

    expect(url).toBe("https://tvthemes.plexapp.com/152831.mp3");
  });

  test("keeps theme music enabled by default and remembers a mute choice", () => {
    const values = new Map<string, string>();
    global.localStorage = {
      getItem: vi.fn(key => values.get(key) || null),
      setItem: vi.fn((key, value) => values.set(key, value)),
      removeItem: vi.fn(key => values.delete(key)),
      clear: vi.fn(() => values.clear())
    } as unknown as Storage;

    expect(readThemeMusicEnabled()).toBe(true);
    saveThemeMusicEnabled(false);
    expect(readThemeMusicEnabled()).toBe(false);
  });

  test("keeps soundtrack previews enabled by default and remembers a choice", () => {
    const values = new Map<string, string>();
    global.localStorage = {
      getItem: vi.fn(key => values.get(key) || null),
      setItem: vi.fn((key, value) => values.set(key, value)),
      removeItem: vi.fn(key => values.delete(key)),
      clear: vi.fn(() => values.clear())
    } as unknown as Storage;

    expect(readThemePreviewsEnabled()).toBe(true);
    saveThemePreviewsEnabled(false);
    expect(readThemePreviewsEnabled()).toBe(false);
  });
});
