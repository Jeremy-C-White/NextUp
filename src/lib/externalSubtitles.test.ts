import { describe, expect, it } from "vitest";
import { chooseBestOpenSubtitlesFile, getOpenSubtitlesApiKey, isValidOpenSubtitlesApiKey, srtToWebVtt } from "./externalSubtitles";

describe("external subtitles", () => {
  it("validates consumer keys without accepting shell punctuation", () => {
    expect(isValidOpenSubtitlesApiKey("A2345678901234567890123456789012")).toBe(true);
    expect(isValidOpenSubtitlesApiKey("short")).toBe(false);
    expect(isValidOpenSubtitlesApiKey("A2345678901234567890&unsafe")).toBe(false);
  });

  it("ships with valid built-in OpenSubtitles access", () => {
    expect(isValidOpenSubtitlesApiKey(getOpenSubtitlesApiKey())).toBe(true);
  });

  it("converts SubRip timestamps to WebVTT", () => {
    const result = srtToWebVtt("1\r\n00:00:01,250 --> 00:00:03,500\r\nHello.\r\n");
    expect(result).toContain("WEBVTT\n\n");
    expect(result).toContain("00:00:01.250 --> 00:00:03.500");
    expect(result).toContain("Hello.");
  });

  it("prefers a trusted release match over a generic popular file", () => {
    const best = chooseBestOpenSubtitlesFile([
      {
        attributes: {
          language: "en",
          download_count: 50000,
          release: "Generic HDTV",
          files: [{ file_id: 1, file_name: "generic.srt" }]
        }
      },
      {
        attributes: {
          language: "en",
          from_trusted: true,
          hearing_impaired: true,
          release: "Show.Name.S01E02.1080p.WEB-DL-GROUP",
          files: [{ file_id: 2, file_name: "Show.Name.S01E02.1080p.WEB-DL-GROUP.srt" }]
        }
      }
    ], "Show.Name.S01E02.1080p.WEB-DL-GROUP.mkv");

    expect(best?.fileId).toBe("2");
  });
});
