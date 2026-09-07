import { describe, expect, it } from "vitest";
import { UserEpisode } from "../types";
import {
  CREDITS_AUTOPLAY_COUNTDOWN_SECONDS,
  findNextReleasedEpisode,
  shouldOfferNextEpisodeShortcut,
  shouldOfferUpNextChoices,
  shouldStartCreditsAutoplay
} from "./autoplay";

const episode = (
  id: string,
  season: number,
  number: number,
  overrides: Partial<UserEpisode> = {}
): UserEpisode => ({
  id,
  showId: 1,
  season,
  number,
  name: `Episode ${number}`,
  airdate: "2020-01-01",
  airstamp: "2020-01-01T20:00:00Z",
  imageUrl: "",
  summary: "",
  watched: false,
  type: "regular",
  ...overrides
});

describe("findNextReleasedEpisode", () => {
  it("finds the next episode even when the input is unsorted", () => {
    const episodes = [episode("e3", 1, 3), episode("e1", 1, 1), episode("e2", 1, 2)];
    expect(findNextReleasedEpisode(episodes, { episodeId: "e1", season: 1, number: 1 })?.id).toBe("e2");
  });

  it("continues seamlessly across a season boundary", () => {
    const episodes = [episode("s2e1", 2, 1), episode("s1e10", 1, 10)];
    expect(findNextReleasedEpisode(episodes, { episodeId: "s1e10", season: 1, number: 10 })?.id).toBe("s2e1");
  });

  it("ignores specials and episodes that have not aired", () => {
    const episodes = [
      episode("e1", 1, 1),
      episode("special", 1, 2, { type: "special" }),
      episode("future", 1, 3, { airdate: "2999-01-01", airstamp: "2999-01-01T20:00:00Z" })
    ];
    expect(findNextReleasedEpisode(episodes, { episodeId: "e1", season: 1, number: 1 })).toBeNull();
  });

  it("returns null after the latest released episode", () => {
    const episodes = [episode("e1", 1, 1), episode("e2", 1, 2)];
    expect(findNextReleasedEpisode(episodes, { episodeId: "e2", season: 1, number: 2 })).toBeNull();
  });
});

describe("shouldOfferNextEpisodeShortcut", () => {
  it("appears during the final five minutes when another episode exists", () => {
    expect(shouldOfferNextEpisodeShortcut(3_000, 2_701, true)).toBe(true);
  });

  it("stays hidden earlier in playback or without another episode", () => {
    expect(shouldOfferNextEpisodeShortcut(3_000, 2_000, true)).toBe(false);
    expect(shouldOfferNextEpisodeShortcut(3_000, 2_900, false)).toBe(false);
  });
});

describe("credits autoplay", () => {
  it("uses a five-second TV-friendly countdown", () => {
    expect(CREDITS_AUTOPLAY_COUNTDOWN_SECONDS).toBe(5);
  });

  it("starts immediately when a trusted outro timestamp is active", () => {
    expect(shouldStartCreditsAutoplay(3_000, 2_100, true, true)).toBe(true);
  });

  it("uses only the final 90 seconds when no outro timestamp exists", () => {
    expect(shouldStartCreditsAutoplay(3_000, 2_909, true, false)).toBe(false);
    expect(shouldStartCreditsAutoplay(3_000, 2_910, true, false)).toBe(true);
  });

  it("never starts without another released episode", () => {
    expect(shouldStartCreditsAutoplay(3_000, 2_950, false, true)).toBe(false);
    expect(shouldStartCreditsAutoplay(3_000, 2_950, false, false)).toBe(false);
  });
});

describe("cross-series Up Next choices", () => {
  it("offers choices during a detected outro without enabling cross-series autoplay", () => {
    expect(shouldOfferUpNextChoices(3_000, 2_100, true, true)).toBe(true);
  });

  it("uses the final 90 seconds when no outro timing is available", () => {
    expect(shouldOfferUpNextChoices(3_000, 2_909, true, false)).toBe(false);
    expect(shouldOfferUpNextChoices(3_000, 2_910, true, false)).toBe(true);
  });

  it("stays hidden when there are no other Up Next choices", () => {
    expect(shouldOfferUpNextChoices(3_000, 2_950, false, true)).toBe(false);
  });
});
