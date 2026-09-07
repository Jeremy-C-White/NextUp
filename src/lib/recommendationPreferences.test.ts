import { describe, expect, it } from "vitest";
import {
  applyRecommendationFeedback,
  EMPTY_RECOMMENDATION_PROFILE,
  getRecommendationReason,
  isRecommendationCandidateInLibrary,
  rankRecommendationCandidates,
  readRecommendationProfile,
  writeRecommendationProfile
} from "./recommendationPreferences";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
}

describe("recommendation preferences", () => {
  it("suppresses exact negative feedback without suppressing an entire genre", () => {
    const disliked = { id: 1, name: "One Drama", genres: ["Drama"] };
    const otherDrama = { id: 2, name: "Another Drama", genres: ["Drama"] };
    const profile = applyRecommendationFeedback(EMPTY_RECOMMENDATION_PROFILE, disliked, "not-for-me", 10);
    expect(rankRecommendationCandidates([disliked, otherDrama], profile)).toEqual([otherDrama]);
  });

  it("moves shared genres forward after More like this", () => {
    const profile = applyRecommendationFeedback(
      EMPTY_RECOMMENDATION_PROFILE,
      { id: 1, name: "Severance", genres: ["Drama", "Science-Fiction"] },
      "more-like-this",
      10
    );
    const comedy = { id: 2, name: "Comedy", genres: ["Comedy"] };
    const scienceFiction = { id: 3, name: "Other Sci-Fi", genres: ["Science-Fiction"] };
    expect(rankRecommendationCandidates([comedy, scienceFiction], profile)[0]).toBe(scienceFiction);
  });

  it("uses Library genres to influence recommendation order", () => {
    const comedy = { id: 2, name: "Comedy", genres: ["Comedy"] };
    const scienceFiction = { id: 3, name: "Other Sci-Fi", genres: ["Science-Fiction"] };
    const library = [{ id: "saved", name: "Severance", genres: ["Science-Fiction"] }];
    expect(rankRecommendationCandidates([comedy, scienceFiction], EMPTY_RECOMMENDATION_PROFILE, library)[0]).toBe(scienceFiction);
  });

  it("recognizes Library matches across provider IDs and title fallbacks", () => {
    const library = [
      { id: "-100", name: "Severance", _tmdbId: 95396, genres: ["Drama"], premiered: "2022-02-18" },
      { id: "movie-a", name: "Arrival", isMovie: true, imdbId: "tt2543164", premiered: "2016-11-11" }
    ];
    expect(isRecommendationCandidateInLibrary({ id: -95396, name: "Severance", _tmdbId: 95396 }, library)).toBe(true);
    expect(isRecommendationCandidateInLibrary({ id: 12, name: "Arrival", isMovie: true, externals: { imdb: "tt2543164" } }, library)).toBe(true);
    expect(isRecommendationCandidateInLibrary({ id: 13, name: "Severance", premiered: "2022" }, library)).toBe(true);
    expect(isRecommendationCandidateInLibrary({ id: 14, name: "Severance", isMovie: true, premiered: "2022" }, library)).toBe(false);
  });

  it("explains personalized and source-based recommendations honestly", () => {
    const profile = applyRecommendationFeedback(
      EMPTY_RECOMMENDATION_PROFILE,
      { id: 1, name: "Severance", genres: ["Drama"] },
      "more-like-this",
      10
    );
    const candidate = { id: 2, name: "New Drama", genres: ["Drama"] };
    expect(getRecommendationReason(candidate, {
      source: { kind: "trending" }, profile, watchedLibrary: [], finishedLibrary: []
    })).toBe("Similar to Severance");
    expect(getRecommendationReason({ id: 3, name: "New Thing" }, {
      source: { kind: "network", name: "Max" }, profile: EMPTY_RECOMMENDATION_PROFILE, watchedLibrary: [], finishedLibrary: []
    })).toBe("Popular on Max");
    expect(getRecommendationReason({ id: 1, name: "Severance", genres: ["Drama"] }, {
      source: { kind: "trending" }, profile, watchedLibrary: [], finishedLibrary: []
    })).toBe("Trending this week");
  });

  it("round-trips a private per-user profile", () => {
    const storage = createStorage();
    const profile = applyRecommendationFeedback(
      EMPTY_RECOMMENDATION_PROFILE,
      { id: 1, name: "Example", genres: ["Drama"] },
      "already-watched",
      10
    );
    expect(writeRecommendationProfile(storage, "user-a", profile)).toBe(true);
    expect(readRecommendationProfile(storage, "user-a")).toEqual(profile);
    expect(readRecommendationProfile(storage, "user-b")).toEqual(EMPTY_RECOMMENDATION_PROFILE);
  });
});
