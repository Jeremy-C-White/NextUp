import { describe, expect, it } from "vitest";
import { PlaybackCandidate } from "../types";
import { selectPhonePlaybackCandidates } from "./phonePlayback";

const candidate = (
  id: string,
  mediaContainer: string,
  container: string,
  quality: string = "1080p"
): PlaybackCandidate => ({
  id,
  url: `https://example.com/${id}`,
  title: `${id}.${quality}.${mediaContainer}`,
  quality,
  mediaContainer,
  container,
  score: 1
});

describe("selectPhonePlaybackCandidates", () => {
  it("keeps opaque probe links but excludes known external formats", () => {
    const selected = selectPhonePlaybackCandidates([
      candidate("native", "mp4", "web-compatible"),
      candidate("opaque", "", "web-probe"),
      candidate("external", "mkv", "external")
    ]);

    expect(selected.map(item => item.id)).toEqual(["native", "opaque"]);
  });

  it("moves an MP4 fallback into the limited startup window", () => {
    const selected = selectPhonePlaybackCandidates([
      ...Array.from({ length: 9 }, (_, index) => candidate(`probe-${index}`, "", "web-probe", "4K")),
      candidate("mp4-fallback", "mp4", "web-compatible")
    ], 8);

    expect(selected.map(item => item.id)).toContain("mp4-fallback");
    expect(selected.findIndex(item => item.id === "mp4-fallback")).toBeLessThanOrEqual(4);
  });
});
