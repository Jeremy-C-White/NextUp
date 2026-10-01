import { describe, expect, it } from "vitest";
import { UserEpisode, UserShow } from "../types";
import { classifyLibraryShow, LIBRARY_SHELVES, normalizeLibraryFilter } from "./libraryShelves";

const NOW = new Date("2026-09-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function show(overrides: Partial<UserShow> = {}): UserShow {
  return { id: "s1", tvmazeId: 1, name: "Show", imageUrl: "", status: "Running", provider: "", addedAt: 0, summary: "", runtime: 30, ...overrides };
}

function episode(season: number, number: number, daysAgo: number, watched: boolean, runtime = 30): UserEpisode {
  const airstamp = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  return { id: `${season}-${number}`, showId: 1, season, number, name: `Ep ${number}`, airdate: airstamp.slice(0, 10), airstamp, imageUrl: "", summary: "", watched, runtime };
}

const classify = (s: UserShow, eps: UserEpisode[] | undefined, partialPlayback: number | null = null) =>
  classifyLibraryShow(s, eps, { now: NOW, partialPlayback });

describe("library shelves", () => {
  it("puts a show you are part-way through on Continue watching with the next episode and time left", () => {
    const eps = [episode(1, 1, 400, true), episode(1, 2, 393, false), episode(1, 3, 386, false)];
    expect(classify(show(), eps)).toEqual({ shelf: "continue", note: "S1 E2 next", detail: "1h left" });
  });

  it("puts a started show with a recent episode on New episodes", () => {
    expect(classify(show(), [episode(1, 1, 30, true), episode(1, 2, 3, false)]))
      .toEqual({ shelf: "new", note: "New · S1 E2" });
    expect(classify(show(), [episode(1, 1, 60, true), episode(1, 2, 20, false), episode(1, 3, 3, false)]))
      .toEqual({ shelf: "new", note: "S1 E2 next", detail: "2 episodes to go" });
  });

  it("keeps never-started shows apart from the ones you are watching, even with a new episode", () => {
    expect(classify(show(), [episode(1, 1, 10, false), episode(1, 2, 3, false)]))
      .toEqual({ shelf: "not-started", note: "2 episodes", detail: "1h in all" });
  });

  it("counts a partly watched first episode as started", () => {
    expect(classify(show(), [episode(1, 1, 100, false), episode(1, 2, 93, false)], 40).shelf).toBe("continue");
  });

  it("puts caught-up running shows on Waiting, with the return date when known", () => {
    expect(classify(show(), [episode(1, 1, 30, true), episode(2, 1, -15, false)]))
      .toEqual({ shelf: "waiting", note: "S2 returns Oct 12" });
    expect(classify(show(), [episode(1, 1, 30, true), episode(1, 2, -2, false)]))
      .toEqual({ shelf: "waiting", note: "New episode Sep 29" });
    expect(classify(show(), [episode(1, 1, 30, true)])).toEqual({ shelf: "waiting", note: "Caught up" });
    expect(classify(show(), [episode(1, 1, -5, false)])).toEqual({ shelf: "waiting", note: "Premieres Oct 2" });
  });

  it("puts fully watched ended shows on Finished", () => {
    expect(classify(show({ status: "Ended" }), [episode(1, 1, 30, true), episode(1, 2, 20, true)]))
      .toEqual({ shelf: "finished", note: "Finished" });
    // Ended but not finished stays on Continue watching.
    expect(classify(show({ status: "Ended" }), [episode(1, 1, 300, true), episode(1, 2, 290, false)]).shelf).toBe("continue");
  });

  it("sorts movies into to-watch, in progress, not out yet and watched", () => {
    const movie = show({ id: "m1", isMovie: true, runtime: 128 });
    const movieEpisode = (daysAgo: number, watched: boolean) => ({ ...episode(1, 1, daysAgo, watched, 0), id: "movie_m1", name: "Movie" });
    expect(classify(movie, [movieEpisode(40, false)])).toEqual({ shelf: "movies", note: "Movie", detail: "2h 8m" });
    expect(classify(movie, [movieEpisode(40, false)], 50)).toEqual({ shelf: "continue", note: "Movie", detail: "1h 4m left" });
    expect(classify(movie, [movieEpisode(-17, false)])).toEqual({ shelf: "waiting", note: "Out Oct 14" });
    expect(classify(movie, [movieEpisode(40, true)])).toEqual({ shelf: "finished", note: "Watched" });
  });

  it("places titles sensibly while their episodes are still loading", () => {
    expect(classify(show({ watchedEpisodes: { "101": 1_700_000_000_000 } }), undefined))
      .toEqual({ shelf: "continue", note: "Loading progress" });
    expect(classify(show(), undefined)).toEqual({ shelf: "not-started", note: "Loading progress" });
  });

  it("maps saved filters from older versions onto the new shelves", () => {
    expect(normalizeLibraryFilter("watching")).toBe("continue");
    expect(normalizeLibraryFilter("behind")).toBe("continue");
    expect(normalizeLibraryFilter("new")).toBe("new");
    expect(normalizeLibraryFilter("caught-up")).toBe("waiting");
    expect(normalizeLibraryFilter("ended")).toBe("finished");
    expect(normalizeLibraryFilter("movies")).toBe("movies");
    expect(normalizeLibraryFilter("finished")).toBe("finished");
    expect(normalizeLibraryFilter(null)).toBe("all");
    expect(normalizeLibraryFilter("nonsense")).toBe("all");
  });

  it("lists the shelves in the order they appear", () => {
    expect(LIBRARY_SHELVES.map(shelf => shelf.title)).toEqual([
      "Continue watching", "New episodes", "Not started yet", "Movies to watch", "Waiting for new episodes", "Finished"
    ]);
  });
});
