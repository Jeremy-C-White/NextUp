import { describe, expect, it } from "vitest";
import { formatPlaybackDiagnostic, getPlaybackSourceDiagnosticFields } from "./playbackDiagnostics";

describe("playback diagnostics", () => {
  it("formats a complete source event as one copy-friendly line", () => {
    const line = formatPlaybackDiagnostic("penalty recorded", {
      reason: "startup-timeout",
      observedMs: "7000ms",
      ...getPlaybackSourceDiagnosticFields({
        id: "source",
        url: "https://media.example/video?token=secret",
        title: "Friends S08E20",
        fingerprint: "fn:friends s08e20 720p.mkv:204818350",
        provider: "1337x",
        quality: "720p",
        videoCodec: "h264",
        score: 1
      }, 2, 8)
    });

    expect(line).toContain("penalty recorded");
    expect(line).toContain('reason="startup-timeout"');
    expect(line).toContain('position="3/8"');
    expect(line).toContain('fingerprint="fn:friends s08e20 720p.mkv:204818350"');
    expect(line).not.toContain("\n");
    expect(line).not.toContain("secret");
  });

  it("redacts URL-shaped values and credential query parameters", () => {
    expect(formatPlaybackDiagnostic("saved", {
      provider: "https://example.com/private?token=secret",
      note: "source?auth=secret&quality=1080p"
    })).toBe(
      '[NextUp playback] saved provider="[redacted-url]" note="source?auth=[redacted]&quality=1080p"'
    );
  });
});

