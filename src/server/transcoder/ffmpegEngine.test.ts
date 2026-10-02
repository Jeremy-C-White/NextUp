import { describe, it, expect } from "vitest";
import { buildFFmpegArgs } from "./ffmpegEngine.js";
import { MediaProbeResult } from "./types.js";

describe("FFmpeg Engine Argument Builder", () => {
  const baseProbe: MediaProbeResult = {
    sourceUrl: "https://download.real-debrid.com/d/xyz/test.mkv",
    formatName: "matroska",
    durationSeconds: 1200,
    video: {
      index: 0,
      streamIndex: 0,
      codec: "h264",
      pixFmt: "yuv420p",
      isHevc: false,
      isH264: true,
    },
    audioStreams: [
      {
        index: 0,
        streamIndex: 1,
        codec: "dts",
        channels: 6,
        isDefault: true,
      },
    ],
    subtitleStreams: [],
    canVideoCopy: true,
    recommendedSegmentType: "mpegts",
  };

  it("places -ss before -i for instantaneous fast keyframe seeking", () => {
    const args = buildFFmpegArgs({
      sourceUrl: baseProbe.sourceUrl,
      probe: baseProbe,
      config: { sourceUrl: baseProbe.sourceUrl, startTime: 345.5 },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });

    const ssIndex = args.indexOf("-ss");
    const iIndex = args.indexOf("-i");

    expect(ssIndex).toBeGreaterThan(-1);
    expect(iIndex).toBeGreaterThan(-1);
    expect(ssIndex).toBeLessThan(iIndex);
    expect(args[ssIndex + 1]).toBe("345.50");
    expect(args.indexOf("-re")).toBeLessThan(iIndex);
  });

  it("copies video stream and transcodes DTS to AAC stereo when video is safe", () => {
    const args = buildFFmpegArgs({
      sourceUrl: baseProbe.sourceUrl,
      probe: baseProbe,
      config: { sourceUrl: baseProbe.sourceUrl },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });

    const cvIndex = args.indexOf("-c:v");
    expect(cvIndex).toBeGreaterThan(-1);
    expect(args[cvIndex + 1]).toBe("copy");

    const caIndex = args.indexOf("-c:a");
    expect(caIndex).toBeGreaterThan(-1);
    expect(args[caIndex + 1]).toBe("aac");
    expect(args).toContain("192k");
    expect(args).toContain("2"); // 2 audio channels
  });

  it("transcodes to H.264 when video copy is unsafe or forceH264 is requested", () => {
    const unsafeProbe: MediaProbeResult = {
      ...baseProbe,
      canVideoCopy: false,
    };

    const args = buildFFmpegArgs({
      sourceUrl: unsafeProbe.sourceUrl,
      probe: unsafeProbe,
      config: { sourceUrl: unsafeProbe.sourceUrl },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });

    const cvIndex = args.indexOf("-c:v");
    expect(args[cvIndex + 1]).toBe("libx264");
    expect(args).toContain("yuv420p");
  });

  it("configures fragmented MP4 (fMP4) for HEVC streams", () => {
    const hevcProbe: MediaProbeResult = {
      ...baseProbe,
      video: {
        index: 0,
        streamIndex: 0,
        codec: "hevc",
        isHevc: true,
        isH264: false,
      },
      recommendedSegmentType: "fmp4",
    };

    const args = buildFFmpegArgs({
      sourceUrl: hevcProbe.sourceUrl,
      probe: hevcProbe,
      config: { sourceUrl: hevcProbe.sourceUrl },
      workDir: "/tmp/test",
      segmentType: "fmp4",
    });

    expect(args).toContain("-hls_segment_type");
    expect(args).toContain("fmp4");
    expect(args).toContain("-hls_fmp4_init_filename");
    expect(args).toContain("init.mp4");
    expect(args[args.indexOf("-tag:v") + 1]).toBe("hvc1");
  });

  it("prefers an English audio track and safely handles video-only files", () => {
    const multiAudioProbe: MediaProbeResult = {
      ...baseProbe,
      audioStreams: [
        { index: 0, streamIndex: 1, codec: "aac", channels: 2, language: "ita", isDefault: true },
        { index: 1, streamIndex: 2, codec: "dts", channels: 6, language: "eng", isDefault: false },
      ],
    };
    const multiAudioArgs = buildFFmpegArgs({
      sourceUrl: multiAudioProbe.sourceUrl,
      probe: multiAudioProbe,
      config: { sourceUrl: multiAudioProbe.sourceUrl },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });
    const mappedStreams = multiAudioArgs
      .map((arg, index) => arg === "-map" ? multiAudioArgs[index + 1] : null)
      .filter(Boolean);
    expect(mappedStreams).toContain("0:2");

    const videoOnlyArgs = buildFFmpegArgs({
      sourceUrl: baseProbe.sourceUrl,
      probe: { ...baseProbe, audioStreams: [] },
      config: { sourceUrl: baseProbe.sourceUrl },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });
    expect(videoOnlyArgs).toContain("-an");
  });

  it("applies subtitle overlay filter when subtitle burning is requested", () => {
    const args = buildFFmpegArgs({
      sourceUrl: baseProbe.sourceUrl,
      probe: baseProbe,
      config: { sourceUrl: baseProbe.sourceUrl, burnSubtitleTrackIndex: 3 },
      workDir: "/tmp/test",
      segmentType: "mpegts",
    });

    expect(args).toContain("-filter_complex");
    expect(args).toContain("[0:v][0:3]overlay[v]");
    // Must force re-encode when burning
    const cvIndex = args.indexOf("-c:v");
    expect(args[cvIndex + 1]).toBe("libx264");
  });
});
