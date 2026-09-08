import { describe, it, expect } from "vitest";
import { analyzeProbeData } from "./prober.js";

describe("Transcoder Prober Module", () => {
  const sourceUrl = "https://download.real-debrid.com/d/abc/sample.mkv";

  it("identifies HEVC and correctly selects fMP4 HLS with video copy", () => {
    const mockProbeJson = {
      format: { format_name: "matroska,webm", duration: "3600.5", bit_rate: "5000000" },
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "hevc",
          profile: "Main 10",
          pix_fmt: "yuv420p10le",
          width: 3840,
          height: 2160,
          r_frame_rate: "24/1",
        },
        {
          index: 1,
          codec_type: "audio",
          codec_name: "dts",
          channels: 6,
          tags: { language: "eng", title: "DTS-HD MA 5.1" },
          disposition: { default: 1 },
        },
      ],
    };

    const result = analyzeProbeData(mockProbeJson, sourceUrl);
    expect(result.video?.isHevc).toBe(true);
    expect(result.canVideoCopy).toBe(true);
    expect(result.recommendedSegmentType).toBe("fmp4"); // Apple requirement for HEVC
    expect(result.audioStreams).toHaveLength(1);
    expect(result.audioStreams[0].codec).toBe("dts");
  });

  it("identifies standard 8-bit H.264 as safe to copy", () => {
    const mockProbeJson = {
      format: { format_name: "matroska", duration: "1200.0" },
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "h264",
          profile: "High",
          pix_fmt: "yuv420p",
          width: 1920,
          height: 1080,
        },
        {
          index: 1,
          codec_type: "audio",
          codec_name: "aac",
          channels: 2,
        },
      ],
    };

    const result = analyzeProbeData(mockProbeJson, sourceUrl);
    expect(result.video?.isH264).toBe(true);
    expect(result.canVideoCopy).toBe(true);
    expect(result.recommendedSegmentType).toBe("mpegts");
  });

  it("requires re-encoding for 10-bit H.264 because Safari decoders only support 8-bit AVC", () => {
    const mockProbeJson = {
      format: { format_name: "matroska", duration: "1200.0" },
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "h264",
          profile: "High 10",
          pix_fmt: "yuv420p10le",
          width: 1920,
          height: 1080,
        },
      ],
    };

    const result = analyzeProbeData(mockProbeJson, sourceUrl);
    expect(result.canVideoCopy).toBe(false);
    expect(result.requiresTranscodeReason).toContain("10-bit");
  });

  it("requires re-encoding for unsupported video formats like VP9 or AV1", () => {
    const mockProbeJson = {
      format: { format_name: "webm" },
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "vp9",
          width: 1920,
          height: 1080,
        },
      ],
    };

    const result = analyzeProbeData(mockProbeJson, sourceUrl);
    expect(result.canVideoCopy).toBe(false);
    expect(result.requiresTranscodeReason).toContain("vp9");
  });

  it("distinguishes text subtitles from bitmap/PGS subtitles", () => {
    const mockProbeJson = {
      format: { format_name: "matroska" },
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "h264",
          pix_fmt: "yuv420p",
        },
        {
          index: 1,
          codec_type: "subtitle",
          codec_name: "subrip",
          tags: { language: "eng", title: "English SRT" },
        },
        {
          index: 2,
          codec_type: "subtitle",
          codec_name: "hdmv_pgs_subtitle",
          tags: { language: "fra", title: "French PGS" },
        },
      ],
    };

    const result = analyzeProbeData(mockProbeJson, sourceUrl);
    expect(result.subtitleStreams).toHaveLength(2);
    expect(result.subtitleStreams[0].isImageBased).toBe(false); // Text SRT
    expect(result.subtitleStreams[1].isImageBased).toBe(true);  // Image PGS
  });
});
