import { describe, expect, it } from "vitest";
import { findEnglishSubtitleTrackIndex, findPreferredSubtitleTrackIndex, isMeaningfulBackwardSeek } from "./subtitleAssist";

describe("subtitle assistance", () => {
  it("prefers English captions and ignores metadata tracks", () => {
    expect(findPreferredSubtitleTrackIndex([
      { kind: "metadata", language: "en" },
      { kind: "subtitles", language: "es" },
      { kind: "captions", label: "English CC" }
    ])).toBe(2);
  });

  it("falls back to the first usable subtitle track", () => {
    expect(findPreferredSubtitleTrackIndex([
      { kind: "chapters", language: "en" },
      { kind: "subtitles", language: "fr" }
    ])).toBe(1);
  });

  it("does not mistake a non-English fallback for an English track", () => {
    expect(findEnglishSubtitleTrackIndex([
      { kind: "subtitles", language: "fr" },
      { kind: "metadata", label: "English metadata" }
    ])).toBe(-1);
  });

  it("only treats a meaningful backward jump as a rewind", () => {
    expect(isMeaningfulBackwardSeek(120, 105)).toBe(true);
    expect(isMeaningfulBackwardSeek(120, 118)).toBe(false);
    expect(isMeaningfulBackwardSeek(120, 135)).toBe(false);
  });
});
