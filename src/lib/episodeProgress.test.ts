import { describe, expect, it } from "vitest";
import { UserEpisode } from "../types";
import { buildEpisodeProgressSelection } from "./episodeProgress";

function episode(id: string, season: number, number: number, overrides: Partial<UserEpisode> = {}): UserEpisode {
  return {
    id,
    showId: 1,
    season,
    number,
    name: id,
    airdate: "2020-01-01",
    airstamp: "2020-01-01T00:00:00Z",
    imageUrl: "",
    summary: "",
    watched: false,
    type: "regular",
    ...overrides
  };
}

describe("buildEpisodeProgressSelection", () => {
  const episodes = [
    episode("s2e1", 2, 1),
    episode("s1e2", 1, 2),
    episode("s1e1", 1, 1)
  ];

  it("marks everything through the selected episode and clears everything after it", () => {
    expect(buildEpisodeProgressSelection(episodes, "s1e2")).toEqual({
      watchedIds: ["s1e1", "s1e2"],
      unwatchedIds: ["s2e1"]
    });
  });

  it("treats caught up through Season 13 as every prior season watched", () => {
    const manySeasons = Array.from({ length: 14 }, (_, index) => (
      episode(`s${index + 1}e1`, index + 1, 1)
    ));
    const selection = buildEpisodeProgressSelection(manySeasons, "s13e1");

    expect(selection?.watchedIds).toHaveLength(13);
    expect(selection?.watchedIds[0]).toBe("s1e1");
    expect(selection?.watchedIds[12]).toBe("s13e1");
    expect(selection?.unwatchedIds).toEqual(["s14e1"]);
  });

  it("can reset a series to the beginning", () => {
    expect(buildEpisodeProgressSelection(episodes, null)).toEqual({
      watchedIds: [],
      unwatchedIds: ["s1e1", "s1e2", "s2e1"]
    });
  });

  it("excludes future episodes and specials from progress changes", () => {
    const mixed = [
      ...episodes,
      episode("future", 2, 2, { airdate: "2999-01-01", airstamp: "2999-01-01T00:00:00Z" }),
      episode("special", 0, 1, { type: "special" })
    ];
    expect(buildEpisodeProgressSelection(mixed, "s2e1")).toEqual({
      watchedIds: ["s1e1", "s1e2", "s2e1"],
      unwatchedIds: []
    });
  });

  it("rejects an episode that cannot be used as a released progress point", () => {
    expect(buildEpisodeProgressSelection(episodes, "missing")).toBeNull();
  });
});
