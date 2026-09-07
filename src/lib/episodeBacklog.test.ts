import { describe, expect, it } from "vitest";
import { buildEpisodeBacklog, formatCatchUpDuration, hasRecentUnwatchedEpisode } from "./episodeBacklog";
import { UserEpisode } from "../types";

function episode(overrides: Partial<UserEpisode>): UserEpisode {
  return {
    id: "episode",
    showId: 1,
    season: 1,
    number: 1,
    name: "Episode",
    airdate: "2026-08-01",
    airstamp: "2026-08-01T20:00:00.000Z",
    imageUrl: "",
    summary: "",
    watched: false,
    ...overrides
  };
}

describe("buildEpisodeBacklog", () => {
  it("counts only released, trackable, unwatched episodes in episode order", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const result = buildEpisodeBacklog([
      episode({ id: "future", season: 2, number: 1, airstamp: "2026-08-20T20:00:00.000Z" }),
      episode({ id: "special", season: 0, number: 1, type: "special" }),
      episode({ id: "watched", season: 1, number: 1, watched: true }),
      episode({ id: "second", season: 1, number: 3, runtime: 50 }),
      episode({ id: "first", season: 1, number: 2 })
    ], 45, now);

    expect(result.unwatchedEpisodes.map(item => item.id)).toEqual(["first", "second"]);
    expect(result.unwatchedCount).toBe(2);
    expect(result.remainingMinutes).toBe(95);
    expect(result.firstUnwatched?.id).toBe("first");
    expect(result.latestUnwatched?.id).toBe("second");
  });

  it("detects a recent unwatched release", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const backlog = buildEpisodeBacklog([
      episode({ id: "recent", airstamp: "2026-08-15T20:00:00.000Z" })
    ], 45, now);

    expect(hasRecentUnwatchedEpisode(backlog, now.getTime())).toBe(true);
  });
});

describe("formatCatchUpDuration", () => {
  it("formats useful minute and hour estimates", () => {
    expect(formatCatchUpDuration(42)).toBe("42m");
    expect(formatCatchUpDuration(60)).toBe("1h");
    expect(formatCatchUpDuration(135)).toBe("2h 15m");
    expect(formatCatchUpDuration(0)).toBe("");
  });
});
