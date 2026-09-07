import { describe, expect, it } from "vitest";
import { PlaybackCandidate } from "../types";
import { selectTVPlaybackCandidates } from "./tvPlayback";

const candidate = (
  id: string,
  quality: string,
  mediaContainer: string,
  container: string = "web-compatible"
): PlaybackCandidate => ({
  id,
  url: `https://example.com/${id}.${mediaContainer}`,
  title: `${id}.${quality}.${mediaContainer}`,
  quality,
  mediaContainer,
  container,
  score: 1
});

describe("selectTVPlaybackCandidates", () => {
  it("keeps the top-ranked sources first", () => {
    const ranked = Array.from({ length: 10 }, (_, index) => candidate(`top-${index}`, "4K", "mkv"));
    expect(selectTVPlaybackCandidates(ranked, 8).slice(0, 4).map(item => item.id)).toEqual([
      "top-0", "top-1", "top-2", "top-3"
    ]);
  });

  it("moves resolution and stable-container fallbacks into the startup window", () => {
    const ranked = [
      ...Array.from({ length: 9 }, (_, index) => candidate(`uhd-${index}`, "4K", "mkv")),
      candidate("full-hd", "1080p", "mkv"),
      candidate("stable-mp4", "4K", "mp4")
    ];
    const selected = selectTVPlaybackCandidates(ranked, 8);
    expect(selected.map(item => item.id)).toContain("full-hd");
    expect(selected.map(item => item.id)).toContain("stable-mp4");
    expect(selected.findIndex(item => item.id === "full-hd")).toBeLessThanOrEqual(5);
    expect(selected.findIndex(item => item.id === "stable-mp4")).toBeLessThanOrEqual(5);
  });

  it("excludes sources that are not eligible for in-app playback", () => {
    const selected = selectTVPlaybackCandidates([
      candidate("compatible", "1080p", "mp4"),
      candidate("unsupported", "4K", "mkv", "external")
    ]);
    expect(selected.map(item => item.id)).toEqual(["compatible"]);
  });
});
