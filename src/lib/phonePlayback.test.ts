import { describe, expect, it } from "vitest";
import { PlaybackCandidate } from "../types";
import {
  getExternalPlayerLaunchUrl,
  selectPhonePlaybackCandidates,
  selectVlcFallbackCandidates
} from "./phonePlayback";

const candidate = (
  id: string,
  mediaContainer: string,
  container: string,
  quality: string = "1080p",
  videoCodec?: string,
  audioCodec?: string
): PlaybackCandidate => ({
  id,
  url: `https://example.com/${id}`,
  title: `${id}.${quality}.${mediaContainer}`,
  quality,
  mediaContainer,
  container,
  videoCodec,
  audioCodec,
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

  it("tries confirmed H264/AAC MP4 before opaque phone probes", () => {
    const selected = selectPhonePlaybackCandidates([
      candidate("opaque-high-score", "", "web-probe", "4K"),
      candidate("hevc-mp4", "mp4", "web-compatible", "1080p", "hevc", "aac"),
      candidate("safari-safe", "mp4", "web-compatible", "1080p", "h264", "aac")
    ]);

    expect(selected.map(item => item.id)).toEqual(["safari-safe", "hevc-mp4", "opaque-high-score"]);
  });
});

describe("VLC fallback", () => {
  it("keeps only external MKV files for the fallback screen", () => {
    const selected = selectVlcFallbackCandidates([
      candidate("native-mp4", "mp4", "web-compatible"),
      candidate("external-mp4", "mp4", "external"),
      candidate("external-mkv", "mkv", "external"),
      candidate("probe-mkv", "mkv", "web-probe")
    ]);

    expect(selected.map(item => item.id)).toEqual(["external-mkv"]);
  });

  it("builds the VLC iOS callback without losing the signed stream URL", () => {
    const streamUrl = "https://cdn.example.com/movie.mkv?token=a+b&expires=123";

    expect(getExternalPlayerLaunchUrl(streamUrl, "ios")).toBe(
      `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`
    );
  });
});
