import { describe, expect, it } from "vitest";
import { findActiveIntroDBSegment, parseIntroDBResponse } from "./introdb";

describe("parseIntroDBResponse", () => {
  it("parses intro, recap, and outro ranges from the current API response", () => {
    const segments = parseIntroDBResponse({
      intro: { start_sec: 77, end_sec: 94, confidence: 1, submission_count: 2 },
      recap: { start_sec: 95, end_sec: 259, confidence: 0.9, submission_count: 1 },
      outro: { start_ms: 2_791_000, end_ms: 2_843_000, confidence: 1, submission_count: 3 }
    });

    expect(segments.intro).toMatchObject({ type: "intro", startSeconds: 77, endSeconds: 94 });
    expect(segments.recap).toMatchObject({ type: "recap", startSeconds: 95, endSeconds: 259 });
    expect(segments.outro).toMatchObject({ type: "outro", startSeconds: 2791, endSeconds: 2843 });
  });

  it("ignores null and malformed ranges", () => {
    const segments = parseIntroDBResponse({
      intro: null,
      recap: { start_sec: 90, end_sec: 30 },
      outro: { start_sec: "not-a-time", end_sec: 200 }
    });

    expect(segments).toEqual({});
  });
});

describe("findActiveIntroDBSegment", () => {
  const segments = parseIntroDBResponse({
    intro: { start_sec: 10, end_sec: 70 },
    recap: { start_sec: 70, end_sec: 120 },
    outro: { start_sec: 2_700, end_sec: 2_760 }
  });

  it("offers the matching segment and switches cleanly at a boundary", () => {
    expect(findActiveIntroDBSegment(segments, 20, 2_800)?.type).toBe("intro");
    expect(findActiveIntroDBSegment(segments, 75, 2_800)?.type).toBe("recap");
    expect(findActiveIntroDBSegment(segments, 2_710, 2_800)?.type).toBe("outro");
  });

  it("honors dismissed segments and rejects timestamps outside the video", () => {
    expect(findActiveIntroDBSegment(segments, 20, 2_800, new Set(["intro"]))).toBeNull();
    expect(findActiveIntroDBSegment(segments, 2_710, 2_600)).toBeNull();
  });
});
