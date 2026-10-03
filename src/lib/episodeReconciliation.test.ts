import { describe, expect, it } from "vitest";
import { UserEpisode } from "../types";
import { preserveLatestEpisodeWatchState } from "./episodeReconciliation";

const episode = (id: string, watched: boolean, watchedAt?: number): UserEpisode => ({
  id,
  showId: 1,
  season: 1,
  number: Number(id),
  name: `Episode ${id}`,
  airdate: "2026-01-01",
  airstamp: "2026-01-01T00:00:00Z",
  imageUrl: "",
  summary: "",
  watched,
  watchedAt
});

describe("episode reconciliation", () => {
  it("keeps a newer optimistic watched state while refreshing metadata", () => {
    const refreshed = [{ ...episode("1", false), name: "Fresh title" }];
    const current = [episode("1", true, 12345)];

    expect(preserveLatestEpisodeWatchState(refreshed, current)).toEqual([{
      ...refreshed[0],
      watched: true,
      watchedAt: 12345
    }]);
  });

  it("keeps a newer optimistic unwatched state", () => {
    const refreshed = [episode("1", true, 12345)];
    const current = [episode("1", false)];

    expect(preserveLatestEpisodeWatchState(refreshed, current)[0]).toMatchObject({
      watched: false,
      watchedAt: undefined
    });
  });

  it("retains newly discovered episodes", () => {
    const refreshed = [episode("1", false), episode("2", false)];
    const current = [episode("1", true, 50)];

    expect(preserveLatestEpisodeWatchState(refreshed, current)).toHaveLength(2);
    expect(preserveLatestEpisodeWatchState(refreshed, current)[1]).toEqual(refreshed[1]);
  });
});
