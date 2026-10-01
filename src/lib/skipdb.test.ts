import { describe, expect, it } from "vitest";
import { parseIntroDBResponse } from "./introdb";
import {
  buildSkipDBUrl,
  mergeSkipSegments,
  needsSkipDBFallback,
  parseSkipDBResponse
} from "./skipdb";

// Real SkipDB response for Friends S08E21 (duration 1320 s supplied).
const FRIENDS_S08E21 = {
  imdb_id: "tt0108778",
  season: 8,
  episode: 21,
  segments: {
    intro: { start_ms: 91200, end_ms: 124200, adjusted: false, offset_ms: 7000, match: "shifted", confidence: 0.82 },
    recap: null,
    outro: { start_ms: 1274000, end_ms: 1318400, adjusted: false, offset_ms: 0, match: "exact", confidence: 0.9 },
    preview: null
  },
  intro_length_estimate_ms: 33000
};

describe("parseSkipDBResponse", () => {
  it("converts SkipDB millisecond ranges into player seconds", () => {
    const segments = parseSkipDBResponse(FRIENDS_S08E21);
    expect(segments.outro).toMatchObject({
      type: "outro",
      startSeconds: 1274,
      endSeconds: 1318.4,
      confidence: 0.9,
      match: "exact"
    });
    expect(segments.intro).toMatchObject({ startSeconds: 91.2, endSeconds: 124.2, match: "shifted" });
    expect(segments.recap).toBeUndefined();
  });

  it("rejects ranges SkipDB marks as out-of-range for this file", () => {
    const segments = parseSkipDBResponse({
      segments: { outro: { start_ms: 2_760_000, end_ms: 2_820_000, match: "out-of-range" } }
    });
    expect(segments.outro).toBeUndefined();
  });

  it("ignores null, zero and malformed ranges", () => {
    expect(parseSkipDBResponse({
      segments: {
        intro: { start_ms: 0, end_ms: 0, match: "exact" },
        recap: { start_ms: 90_000, end_ms: 30_000, match: "exact" },
        outro: { start_ms: null, end_ms: 1_000, match: "exact" }
      }
    })).toEqual({});
    expect(parseSkipDBResponse(null)).toEqual({});
    expect(parseSkipDBResponse({ segments: null })).toEqual({});
  });
});

describe("buildSkipDBUrl", () => {
  it("sends the IMDb id, episode and rounded stream length", () => {
    const url = new URL(buildSkipDBUrl("TT0108778", 8, 21, 1319.6) || "");
    expect(url.origin + url.pathname).toBe("https://api.skipdb.tv/api/segments");
    expect(url.searchParams.get("imdb_id")).toBe("tt0108778");
    expect(url.searchParams.get("season")).toBe("8");
    expect(url.searchParams.get("episode")).toBe("21");
    expect(url.searchParams.get("duration")).toBe("1320");
  });

  it("omits an unknown duration and rejects invalid ids", () => {
    const url = new URL(buildSkipDBUrl("tt0108778", 1, 1) || "");
    expect(url.searchParams.has("duration")).toBe(false);
    expect(buildSkipDBUrl("not-an-id", 1, 1, 1320)).toBeNull();
  });
});

describe("mergeSkipSegments", () => {
  // Real IntroDB response for Friends S08E20: intro only, no outro.
  const introDBOnly = parseIntroDBResponse({
    intro: { start_sec: 116, end_sec: 151, confidence: 1, submission_count: 1 },
    recap: null,
    outro: null
  });

  it("keeps IntroDB's intro and fills the missing credits from SkipDB", () => {
    const merged = mergeSkipSegments(introDBOnly, parseSkipDBResponse(FRIENDS_S08E21));
    expect(merged.segments.intro).toMatchObject({ startSeconds: 116, endSeconds: 151 });
    expect(merged.segments.outro).toMatchObject({ startSeconds: 1274, endSeconds: 1318.4 });
    expect(merged.sources).toEqual({ intro: "introdb", outro: "skipdb" });
    expect(merged.segments.outro).not.toHaveProperty("match");
  });

  it("never replaces a segment IntroDB already has", () => {
    const full = parseIntroDBResponse({
      intro: { start_sec: 10, end_sec: 40 },
      recap: { start_sec: 0, end_sec: 9 },
      outro: { start_sec: 1200, end_sec: 1300 }
    });
    const merged = mergeSkipSegments(full, parseSkipDBResponse(FRIENDS_S08E21));
    expect(merged.segments).toEqual(full);
    expect(needsSkipDBFallback(full)).toBe(false);
  });

  it("uses SkipDB alone when IntroDB was unavailable", () => {
    const merged = mergeSkipSegments({}, parseSkipDBResponse(FRIENDS_S08E21));
    expect(merged.sources).toEqual({ intro: "skipdb", outro: "skipdb" });
    expect(needsSkipDBFallback({})).toBe(true);
    expect(needsSkipDBFallback(introDBOnly)).toBe(true);
  });
});

