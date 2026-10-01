import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserShow } from "../types";
import {
  buildTitleLogoUrl,
  classifyLogoTone,
  pickBestTitleLogo,
  prefetchTitleLogos,
  readCachedTitleLogo,
  resetTitleLogoMemory,
  resolveLogoTmdbId,
  resolveTitleLogo,
  saveTitleLogo,
  TITLE_LOGO_CACHE_KEY,
  UNREADABLE_TTL_MS
} from "./titleLogos";

const light = { detectTone: async () => "light" as const };

const DAY = 24 * 60 * 60 * 1000;

function memoryStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; }
  };
}

function pixels(rgba: [number, number, number, number], count: number) {
  return Array.from({ length: count }, () => rgba).flat();
}

beforeEach(() => {
  resetTitleLogoMemory();
});

describe("choosing a title logo", () => {
  it("picks the best-rated English PNG (real TMDB data for Friends)", () => {
    const logos = [
      { aspect_ratio: 6.015, height: 131, iso_639_1: "en", file_path: "/blVfE2u4uytU0f8yUO2XvhNSS2Y.png", vote_average: 3.334, vote_count: 3, width: 788 },
      { aspect_ratio: 6.077, height: 195, iso_639_1: "en", file_path: "/7b4Ri64SrA4NoZMuRfjmZ4OWU2U.svg", vote_average: 1.31, vote_count: 8, width: 1185 },
      { aspect_ratio: 7.889, height: 45, iso_639_1: "en", file_path: "/vFM5GJw8Mcqox6wII6DVAIi8h3r.png", vote_average: 0, vote_count: 1, width: 355 }
    ];
    expect(pickBestTitleLogo(logos)?.file_path).toBe("/blVfE2u4uytU0f8yUO2XvhNSS2Y.png");
  });

  it("prefers English, then language-free logos, and never other languages", () => {
    const pick = pickBestTitleLogo([
      { file_path: "/fr.png", iso_639_1: "fr", vote_average: 9 },
      { file_path: "/neutral.png", iso_639_1: null, vote_average: 8 },
      { file_path: "/english.png", iso_639_1: "en", vote_average: 1 }
    ]);
    expect(pick?.file_path).toBe("/english.png");
    expect(pickBestTitleLogo([
      { file_path: "/fr.png", iso_639_1: "fr", vote_average: 9 },
      { file_path: "/neutral.png", iso_639_1: null, vote_average: 2 }
    ])?.file_path).toBe("/neutral.png");
    expect(pickBestTitleLogo([{ file_path: "/de.png", iso_639_1: "de" }])).toBeNull();
  });

  it("prefers PNG over SVG at the same language", () => {
    expect(pickBestTitleLogo([
      { file_path: "/a.svg", iso_639_1: "en", vote_average: 9 },
      { file_path: "/b.png", iso_639_1: "en", vote_average: 1 }
    ])?.file_path).toBe("/b.png");
  });

  it("ignores malformed entries", () => {
    expect(pickBestTitleLogo(null)).toBeNull();
    expect(pickBestTitleLogo([{ file_path: "https://evil.example/x.png", iso_639_1: "en" }, { iso_639_1: "en" }, "x"])).toBeNull();
  });

  it("builds a sized TMDB image URL", () => {
    expect(buildTitleLogoUrl("/abc.png")).toBe("https://image.tmdb.org/t/p/w500/abc.png");
  });
});

describe("logo tone", () => {
  it("marks black and very dark logos as dark", () => {
    expect(classifyLogoTone(pixels([0, 0, 0, 255], 200))).toBe("dark");
    expect(classifyLogoTone(pixels([40, 30, 60, 255], 200))).toBe("dark");
    expect(classifyLogoTone(pixels([60, 60, 64, 255], 200))).toBe("dark");
  });

  it("marks white and colourful logos as light", () => {
    expect(classifyLogoTone(pixels([255, 255, 255, 255], 200))).toBe("light");
    expect(classifyLogoTone(pixels([230, 180, 20, 255], 200))).toBe("light");
    // A strong red or blue logo keeps its colour.
    expect(classifyLogoTone(pixels([200, 20, 30, 255], 200))).toBe("light");
    expect(classifyLogoTone(pixels([30, 60, 210, 255], 200))).toBe("light");
    // Mostly dark lettering with bright highlights stays as-is.
    expect(classifyLogoTone([...pixels([10, 10, 10, 255], 150), ...pixels([250, 250, 250, 255], 50)])).toBe("light");
  });

  it("ignores transparent pixels and gives up on empty images", () => {
    expect(classifyLogoTone([...pixels([0, 0, 0, 0], 500), ...pixels([255, 255, 255, 255], 40)])).toBe("light");
    expect(classifyLogoTone(pixels([0, 0, 0, 0], 500))).toBe("unknown");
  });
});

describe("logo cache", () => {
  it("returns undefined for unknown titles and remembers found and missing logos", () => {
    const storage = memoryStorage();
    const now = 1_000_000;
    expect(readCachedTitleLogo("show-1", storage, now)).toBeUndefined();
    saveTitleLogo("show-1", { url: "https://image.tmdb.org/t/p/w500/a.png", tone: "dark", aspectRatio: 3.5 }, storage, now);
    saveTitleLogo("show-2", null, storage, now);
    expect(readCachedTitleLogo("show-1", storage, now)).toEqual({ url: "https://image.tmdb.org/t/p/w500/a.png", tone: "dark", aspectRatio: 3.5 });
    expect(readCachedTitleLogo("show-2", storage, now)).toBeNull();
    expect(JSON.parse(storage.store[TITLE_LOGO_CACHE_KEY])["show-1"].u).toContain("/a.png");
  });

  it("expires missing logos after 3 days and found logos after 21 days", () => {
    const storage = memoryStorage();
    saveTitleLogo("found", { url: "https://image.tmdb.org/t/p/w500/a.png", tone: "light", aspectRatio: 4 }, storage, 0);
    saveTitleLogo("missing", null, storage, 0);
    expect(readCachedTitleLogo("missing", storage, 2 * DAY)).toBeNull();
    expect(readCachedTitleLogo("missing", storage, 4 * DAY)).toBeUndefined();
    expect(readCachedTitleLogo("found", storage, 20 * DAY)?.url).toContain("/a.png");
    expect(readCachedTitleLogo("found", storage, 22 * DAY)).toBeUndefined();
  });

  it("keeps at most 300 titles, dropping the oldest", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 305; index += 1) saveTitleLogo(`show-${index}`, null, storage, 1_000 + index);
    const saved = JSON.parse(storage.store[TITLE_LOGO_CACHE_KEY]);
    expect(Object.keys(saved)).toHaveLength(300);
    expect(saved["show-0"]).toBeUndefined();
    expect(saved["show-304"]).toBeDefined();
  });

  it("survives unreadable storage", () => {
    const storage = { getItem: () => "{not json", setItem: () => { throw new Error("quota"); } };
    expect(readCachedTitleLogo("x", storage)).toBeUndefined();
    expect(() => saveTitleLogo("x", null, storage)).not.toThrow();
  });
});

describe("looking up logos", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    (globalThis as any).window = { localStorage: storage };
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

  it("finds the TMDB id from stored ids, movie ids and TMDB-sourced shows", async () => {
    expect(await resolveLogoTmdbId({ id: "82", _tmdbId: 1668 } as UserShow)).toBe(1668);
    expect(await resolveLogoTmdbId({ id: "-1000000603", isMovie: true } as UserShow)).toBe(603);
    expect(await resolveLogoTmdbId({ id: "-1668", isMovie: false } as UserShow)).toBe(1668);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("looks up a show's logo by IMDb id, caches it, and shares concurrent lookups", async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes("/find/tt0108778")) return json({ tv_results: [{ id: 1668 }] });
      if (url.includes("/tv/1668/images")) {
        expect(url).toContain("include_image_language=en%2Cnull");
        return json({ logos: [{ file_path: "/friends.png", iso_639_1: "en", vote_average: 3, aspect_ratio: 6 }] });
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    const show = { id: "431", name: "Friends", imdbId: "tt0108778" } as UserShow;
    const [first, second] = await Promise.all([resolveTitleLogo(show, light), resolveTitleLogo(show, light)]);
    expect(first).toEqual({ url: "https://image.tmdb.org/t/p/w500/friends.png", tone: "light", aspectRatio: 6 });
    expect(second).toBe(first);
    const imageCalls = fetchSpy.mock.calls.filter(([input]) => String(input).includes("/images"));
    expect(imageCalls).toHaveLength(1);
    expect(readCachedTitleLogo("431")?.url).toContain("/friends.png");
  });

  it("remembers titles without a logo, but not network failures", async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes("/movie/42/images")) return json({ logos: [] });
      return { ok: false, status: 500, json: async () => ({}) } as Response;
    });
    expect(await resolveTitleLogo({ id: "m42", isMovie: true, _tmdbId: 42 } as UserShow, light)).toBeNull();
    expect(readCachedTitleLogo("m42")).toBeNull();

    await expect(resolveTitleLogo({ id: "s7", _tmdbId: 7 } as UserShow, light)).rejects.toBeTruthy();
    expect(readCachedTitleLogo("s7")).toBeUndefined();
  }, 20_000);

  it("never caches a failed IMDb id lookup as 'no logo'", async () => {
    fetchSpy.mockImplementation(async () => { throw new TypeError("offline"); });
    await expect(resolveTitleLogo({ id: "tvmaze-1", imdbId: "tt0108778" } as UserShow, light)).rejects.toBeTruthy();
    expect(readCachedTitleLogo("tvmaze-1")).toBeUndefined();
  }, 20_000);

  it("uses the text title for now when a logo's colours cannot be checked", async () => {
    fetchSpy.mockImplementation(async () => json({ logos: [{ file_path: "/maybe-dark.png", iso_639_1: "en" }] }));
    const unreadable = { detectTone: async () => "unknown" as const };
    expect(await resolveTitleLogo({ id: "u1", _tmdbId: 5 } as UserShow, unreadable)).toBeNull();
    const now = Date.now();
    expect(readCachedTitleLogo("u1", storage, now)).toBeNull();
    expect(readCachedTitleLogo("u1", storage, now + UNREADABLE_TTL_MS + 1000)).toBeUndefined();
  });

  it("ignores saved logos without a checked tone", () => {
    saveTitleLogo("old", { url: "https://image.tmdb.org/t/p/w500/x.png", tone: "unknown", aspectRatio: 3 });
    expect(readCachedTitleLogo("old")).toBeUndefined();
  });

  it("prefetches a queue without repeating known titles or stopping on failures", async () => {
    saveTitleLogo("known", null);
    const requested: string[] = [];
    fetchSpy.mockImplementation(async (input: any) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("/tv/1/images")) throw new TypeError("offline");
      return json({ logos: [{ file_path: "/logo.png", iso_639_1: "en" }] });
    });
    await prefetchTitleLogos([
      { id: "known", _tmdbId: 9 } as UserShow,
      { id: "a", _tmdbId: 1 } as UserShow,
      { id: "b", _tmdbId: 2 } as UserShow,
      { id: "b", _tmdbId: 2 } as UserShow
    ], undefined, light);
    expect(requested.some(url => url.includes("/tv/9/"))).toBe(false);
    expect(readCachedTitleLogo("b")?.url).toContain("/logo.png");
    expect(readCachedTitleLogo("a")).toBeUndefined();
  }, 20_000);
});

