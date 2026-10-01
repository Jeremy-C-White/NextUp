import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserShow } from "../types";
import {
  buildDeezerSearchUrl,
  buildThemeSearchQueries,
  buildThemerrDbUrl,
  buildYoutubeOembedUrl,
  cleanThemeHint,
  DeezerThemeTrack,
  parseDeezerSearch,
  parseThemerrYoutubeUrl,
  pickBestThemeTrack,
  readRejectedThemeTrackIds,
  rejectThemeTrack,
  resolveFallbackTheme,
  resolveThemeTmdbId,
  scoreThemeTrack
} from "./themeMusic";

const track = (overrides: Partial<DeezerThemeTrack>): DeezerThemeTrack => ({
  id: 1,
  title: "Track",
  artist: "Artist",
  album: "Album",
  previewUrl: "https://cdnt-preview.dzcdn.net/preview.mp3",
  durationSeconds: 180,
  ...overrides
});

describe("ThemerrDB and YouTube title helpers", () => {
  it("builds ThemerrDB lookups by TMDB id for movies and shows", () => {
    expect(buildThemerrDbUrl(true, 603)).toBe("https://app.lizardbyte.dev/ThemerrDB/movies/themoviedb/603.json");
    expect(buildThemerrDbUrl(false, 1668)).toBe("https://app.lizardbyte.dev/ThemerrDB/tv_shows/themoviedb/1668.json");
    expect(buildThemerrDbUrl(true, 0)).toBeNull();
  });

  it("reads only a real YouTube watch link from ThemerrDB", () => {
    // Real ThemerrDB value for Friends (TMDB 1668).
    expect(parseThemerrYoutubeUrl({ youtube_theme_url: "https://www.youtube.com/watch?v=s2TyVQGoCYo" }))
      .toBe("https://www.youtube.com/watch?v=s2TyVQGoCYo");
    expect(parseThemerrYoutubeUrl({ youtube_theme_url: "https://example.com/theme.mp3" })).toBeNull();
    expect(parseThemerrYoutubeUrl({})).toBeNull();
  });

  it("asks YouTube oEmbed only for the video title", () => {
    const url = new URL(buildYoutubeOembedUrl("https://www.youtube.com/watch?v=s2TyVQGoCYo"));
    expect(url.origin + url.pathname).toBe("https://www.youtube.com/oembed");
    expect(url.searchParams.get("format")).toBe("json");
  });

  it("cleans video-title noise into a music search query", () => {
    expect(cleanThemeHint("The Rembrandts - I'll Be There For You (Official Music Video) [HD]"))
      .toBe("The Rembrandts - I'll Be There For You");
    expect(cleanThemeHint("Star Trek Voyager Theme | Full Version")).toBe("Star Trek Voyager Theme");
    expect(cleanThemeHint("HD")).toBeNull();
  });
});

describe("Deezer search parsing", () => {
  it("keeps only tracks with a playable https preview", () => {
    const tracks = parseDeezerSearch({
      data: [
        { id: 11, title: "Main Title", preview: "https://cdnt-preview.dzcdn.net/a.mp3", duration: 190, artist: { name: "Composer" }, album: { title: "The Film (Original Motion Picture Soundtrack)" } },
        { id: 12, title: "No Preview", preview: "", duration: 100, artist: { name: "X" }, album: { title: "Y" } },
        { id: "bad", title: "Bad Id", preview: "https://cdnt-preview.dzcdn.net/b.mp3" }
      ]
    });
    expect(tracks).toEqual([{
      id: 11,
      title: "Main Title",
      artist: "Composer",
      album: "The Film (Original Motion Picture Soundtrack)",
      previewUrl: "https://cdnt-preview.dzcdn.net/a.mp3",
      durationSeconds: 190
    }]);
    expect(parseDeezerSearch({ error: { message: "Quota limit exceeded" } })).toEqual([]);
  });

  it("builds a Deezer search request", () => {
    const url = new URL(buildDeezerSearchUrl("The Matrix soundtrack main title"));
    expect(url.origin + url.pathname).toBe("https://api.deezer.com/search");
    expect(url.searchParams.get("q")).toBe("The Matrix soundtrack main title");
  });
});

describe("choosing the theme track", () => {
  const movie = { mediaTitle: "The Matrix", isMovie: true };

  it("prefers the soundtrack album's main title", () => {
    const best = pickBestThemeTrack([
      track({ id: 1, title: "Clubbed to Death", album: "Clubbed to Death", artist: "Rob Dougan" }),
      track({ id: 2, title: "Main Title / Trinity Infinity", album: "The Matrix (Original Motion Picture Score)", artist: "Don Davis" }),
      track({ id: 3, title: "Spybreak!", album: "The Matrix: Music From The Motion Picture", artist: "Propellerheads" })
    ], movie);
    expect(best?.track.id).toBe(2);
  });

  it("rejects covers, karaoke and tribute versions", () => {
    const cover = track({ title: "The Matrix Main Theme (Piano Cover)", album: "Movie Themes Covers", artist: "Piano Tribute Players" });
    expect(scoreThemeTrack(cover, movie)).toBeLessThan(45);
  });

  it("returns nothing when no track is tied to the title", () => {
    expect(pickBestThemeTrack([
      track({ title: "Main Title", album: "Some Other Film (Original Score)" })
    ], movie)).toBeNull();
  });

  it("uses the ThemerrDB hint to pick the right song for a show", () => {
    const context = {
      mediaTitle: "Friends",
      isMovie: false,
      themeHint: "The Rembrandts - I'll Be There For You"
    };
    const best = pickBestThemeTrack([
      track({ id: 7, title: "I'll Be There for You", artist: "The Rembrandts", album: "L.P." }),
      track({ id: 8, title: "Smelly Cat", artist: "Phoebe", album: "Friends Again" })
    ], context);
    expect(best?.track.id).toBe(7);
  });

  it("prefers the original performer over a sound-alike re-recording", () => {
    const context = {
      mediaTitle: "Friends",
      isMovie: false,
      themeHint: "The Rembrandts - I'll Be There For You"
    };
    const best = pickBestThemeTrack([
      track({ id: 20, title: "I'll Be There for You (From \"Friends\")", artist: "TV Theme Song Players", album: "Greatest TV Themes" }),
      track({ id: 21, title: "I'll Be There for You", artist: "The Rembrandts", album: "LP" })
    ], context);
    expect(best?.track.id).toBe(21);
  });

  it("never lets a generic hint pick an unrelated film's theme", () => {
    expect(pickBestThemeTrack([
      track({ title: "Main Theme", album: "Another Film (Original Score)", artist: "Composer" })
    ], { mediaTitle: "The Matrix", isMovie: true, themeHint: "Main Theme" })).toBeNull();
  });

  it("skips tracks the viewer marked 'Not this song'", () => {
    const tracks = [
      track({ id: 2, title: "Main Title", album: "The Matrix (Original Motion Picture Score)" }),
      track({ id: 3, title: "Main Theme", album: "The Matrix (Original Motion Picture Soundtrack)" })
    ];
    expect(pickBestThemeTrack(tracks, movie, new Set([2]))?.track.id).toBe(3);
  });

  it("searches with the hint first, then soundtrack queries", () => {
    expect(buildThemeSearchQueries({ mediaTitle: "Friends", isMovie: false, themeHint: "I'll Be There For You" }))
      .toEqual(["I'll Be There For You", "Friends theme", "Friends main title theme soundtrack"]);
    expect(buildThemeSearchQueries({ mediaTitle: "The Matrix", isMovie: true }))
      .toEqual(["The Matrix soundtrack main title", "The Matrix original motion picture soundtrack"]);
  });
});

describe("rejected songs and ids", () => {
  it("remembers rejected Deezer track ids per title", () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (key: string) => store[key] ?? null, setItem: (key: string, value: string) => { store[key] = value; } };
    rejectThemeTrack(storage, "show-1", 42);
    rejectThemeTrack(storage, "show-1", 43);
    expect(Array.from(readRejectedThemeTrackIds(storage, "show-1"))).toEqual([42, 43]);
    expect(readRejectedThemeTrackIds(storage, "show-2").size).toBe(0);
  });

  it("derives a movie's TMDB id from its library id", async () => {
    const movie = { id: "-1000000603", isMovie: true, name: "The Matrix" } as unknown as UserShow;
    expect(await resolveThemeTmdbId(movie)).toBe(603);
    expect(await resolveThemeTmdbId({ ...movie, _tmdbId: 604 } as UserShow)).toBe(604);
  });
});

describe("resolveFallbackTheme", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; }
      }
    };
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it("follows ThemerrDB to a Deezer preview for a movie", async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const target = decodeURIComponent(String(input).split("url=")[1] || "");
      if (target.includes("ThemerrDB/movies/themoviedb/603.json")) {
        return jsonResponse({ youtube_theme_url: "https://www.youtube.com/watch?v=SLBACEP6LsI" });
      }
      if (target.includes("youtube.com/oembed")) {
        return jsonResponse({ title: "The Matrix Soundtrack - Main Title (Don Davis) [HD]" });
      }
      if (target.includes("api.deezer.com/search")) {
        return jsonResponse({
          data: [
            { id: 900, title: "Main Title / Trinity Infinity", preview: "https://cdnt-preview.dzcdn.net/main.mp3", duration: 220, artist: { name: "Don Davis" }, album: { title: "The Matrix (Original Motion Picture Score)" } },
            { id: 901, title: "The Matrix Theme (Karaoke Version)", preview: "https://cdnt-preview.dzcdn.net/k.mp3", duration: 200, artist: { name: "Karaoke Stars" }, album: { title: "Movie Karaoke" } }
          ]
        });
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const movie = { id: "-1000000603", isMovie: true, name: "The Matrix" } as unknown as UserShow;
    const theme = await resolveFallbackTheme(movie, { refresh: true });
    expect(theme?.track.id).toBe(900);
    expect(theme?.hintSource).toBe("themerrdb");
    expect(theme?.track.previewUrl).toBe("https://cdnt-preview.dzcdn.net/main.mp3");
  });

  it("stays silent when nothing matches the title", async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const target = decodeURIComponent(String(input).split("url=")[1] || "");
      if (target.includes("api.deezer.com/search")) {
        return jsonResponse({ data: [{ id: 5, title: "Random Song", preview: "https://cdnt-preview.dzcdn.net/r.mp3", artist: { name: "Someone" }, album: { title: "Hits" } }] });
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    const show = { id: "999", isMovie: false, name: "Obscure Show" } as unknown as UserShow;
    expect(await resolveFallbackTheme(show, { refresh: true })).toBeNull();
  });
});

