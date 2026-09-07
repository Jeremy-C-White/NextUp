import { describe, expect, it } from "vitest";
import { UserEpisode, UserShow } from "../types";
import { formatUpNextAirDate, rankUpNextItems, UpNextQueueItem } from "./upNext";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-28T12:00:00Z");

function queueItem(name: string, releaseAgeDays: number, watchedAgeDays?: number, addedAgeDays = 365): UpNextQueueItem {
  const watchedAt = watchedAgeDays === undefined ? undefined : NOW - watchedAgeDays * DAY_MS;
  const show: UserShow = {
    id: name.toLowerCase().replace(/\s/g, "-"),
    tvmazeId: Math.abs(name.length * 100),
    name,
    imageUrl: "",
    status: "Running",
    provider: "",
    addedAt: NOW - addedAgeDays * DAY_MS,
    summary: "",
    watchedEpisodes: watchedAt ? { watched: watchedAt } : {}
  };
  const nextEp: UserEpisode = {
    id: `${show.id}-episode`,
    showId: show.tvmazeId,
    season: 1,
    number: 2,
    name: "Next episode",
    airdate: "",
    airstamp: new Date(NOW - releaseAgeDays * DAY_MS).toISOString(),
    imageUrl: "",
    summary: "",
    watched: false
  };
  return { show, nextEp, progress: 25 };
}

describe("rankUpNextItems", () => {
  it("puts newly aired episodes before recently watched and recently added shows", () => {
    const ranked = rankUpNextItems([
      queueItem("Recently added", 100, undefined, 1),
      queueItem("Recently watched", 100, 1, 200),
      queueItem("New episode", 2, undefined, 200)
    ], NOW);

    expect(ranked.map(item => item.show.name)).toEqual(["New episode", "Recently watched", "Recently added"]);
    expect(ranked.map(item => item.queueReason)).toEqual(["New episode", "Continue watching", "Recently added"]);
  });

  it("orders new episodes by their air time", () => {
    const ranked = rankUpNextItems([
      queueItem("A week old", 7),
      queueItem("A day old", 1)
    ], NOW);

    expect(ranked.map(item => item.show.name)).toEqual(["A day old", "A week old"]);
  });

  it("orders active series by the most recent watch time", () => {
    const ranked = rankUpNextItems([
      queueItem("Watched last week", 100, 7),
      queueItem("Watched yesterday", 100, 1)
    ], NOW);

    expect(ranked.map(item => item.show.name)).toEqual(["Watched yesterday", "Watched last week"]);
  });

  it("orders newly added shows by date added", () => {
    const ranked = rankUpNextItems([
      queueItem("Added last week", 100, undefined, 7),
      queueItem("Added today", 100, undefined, 0)
    ], NOW);

    expect(ranked.map(item => item.show.name)).toEqual(["Added today", "Added last week"]);
  });

  it("does not label old episodes or stale activity as recent", () => {
    const [item] = rankUpNextItems([queueItem("Older queue item", 100, 90, 90)], NOW);
    expect(item.queueReason).toBe("Ready to watch");
  });
});

describe("formatUpNextAirDate", () => {
  const now = new Date(2026, 6, 28, 20, 0, 0);

  it("uses a friendly label for an episode that aired today", () => {
    expect(formatUpNextAirDate(new Date(2026, 6, 28, 9, 0, 0), now)).toBe("Aired today");
  });

  it("uses a friendly label for an episode that aired yesterday", () => {
    expect(formatUpNextAirDate(new Date(2026, 6, 27, 23, 0, 0), now)).toBe("Aired yesterday");
  });

  it("uses a compact date for older episodes", () => {
    expect(formatUpNextAirDate(new Date(2026, 6, 25, 20, 0, 0), now)).toBe("Aired Jul 25");
    expect(formatUpNextAirDate(new Date(2025, 11, 31, 20, 0, 0), now)).toBe("Aired Dec 31, 2025");
  });
});
