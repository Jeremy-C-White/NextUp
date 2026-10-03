import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJustReleasedMoviesTMDB } from "./tmdb";
import { getRecommendationReason, EMPTY_RECOMMENDATION_PROFILE } from "./recommendationPreferences";

const NOW = Date.parse("2026-09-27T12:00:00Z");

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear()
  };
}

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
const movie = (id: number, title: string) => ({ id, title, poster_path: `/${id}.jpg`, backdrop_path: `/${id}-b.jpg`, genre_ids: [18], vote_average: 7, release_date: "2026-09-01" });
const usDates = (...entries: Array<[number, string]>) => ({
  results: [{ iso_3166_1: "US", release_dates: entries.map(([type, date]) => ({ type, release_date: `${date}T00:00:00.000Z` })) }]
});

describe("getJustReleasedMoviesTMDB", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as any).localStorage = memoryStorage();
    (globalThis as any).window = { localStorage: (globalThis as any).localStorage };
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it("keeps only movies first out at home in the last 60 days, most popular first", async () => {
    const requested: string[] = [];
    fetchSpy.mockImplementation(async (input: any) => {
      const url = new URL(String(input));
      requested.push(url.pathname + url.search);
      if (url.pathname.endsWith("/discover/movie")) {
        expect(url.searchParams.get("with_release_type")).toBe("4|5|6");
        expect(url.searchParams.get("region")).toBe("US");
        expect(url.searchParams.get("release_date.gte")).toBe("2026-07-29");
        expect(url.searchParams.get("release_date.lte")).toBe("2026-09-27");
        return url.searchParams.get("page") === "1"
          ? json({ results: [movie(1, "New On Digital"), movie(2, "Old Movie New Disc"), movie(3, "Streaming Original")] })
          : json({ results: [movie(3, "Streaming Original"), movie(4, "Coming Soon Home")] });
      }
      if (url.pathname.endsWith("/movie/1/release_dates")) return json(usDates([3, "2026-07-10"], [4, "2026-09-15"]));
      if (url.pathname.endsWith("/movie/2/release_dates")) return json(usDates([4, "2026-05-12"], [5, "2026-08-11"]));
      if (url.pathname.endsWith("/movie/3/release_dates")) return json(usDates([4, "2026-09-05"]));
      if (url.pathname.endsWith("/movie/4/release_dates")) return json(usDates([3, "2026-09-01"], [4, "2026-10-20"]));
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const shows = await getJustReleasedMoviesTMDB(NOW);
    expect(shows.map(show => show.name)).toEqual(["New On Digital", "Streaming Original"]);
    expect(shows[0]).toMatchObject({ isMovie: true, _tmdbId: 1, id: -1000000001, homeReleaseDate: "2026-09-15" });
    expect(requested.filter(path => path.includes("/movie/3/release_dates"))).toHaveLength(1);

    fetchSpy.mockClear();
    expect((await getJustReleasedMoviesTMDB(NOW)).map(show => show.name)).toEqual(["New On Digital", "Streaming Original"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not remember an empty row when the release dates could not be checked", async () => {
    fetchSpy.mockImplementation(async (input: any) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/discover/movie")) return json({ results: [movie(1, "A"), movie(2, "B")] });
      throw new TypeError("offline");
    });
    await expect(getJustReleasedMoviesTMDB(NOW)).rejects.toThrow();
    expect((globalThis as any).localStorage.length).toBe(0);
  }, 30_000);

  it("shows the at-home date as the reason in this row", () => {
    const context = { source: { kind: "just-released" } as const, profile: EMPTY_RECOMMENDATION_PROFILE, watchedLibrary: [], finishedLibrary: [] };
    expect(getRecommendationReason({ id: 1, name: "New On Digital", homeReleaseDate: "2026-09-15" }, context)).toBe("At home since Sep 15");
    expect(getRecommendationReason({ id: 2, name: "No Date" }, context)).toBe("New to watch at home");
    expect(getRecommendationReason({ id: 1, name: "New On Digital", homeReleaseDate: "2026-09-15" }, { ...context, inLibrary: true })).toBe("Saved in your Library");
  });
});
