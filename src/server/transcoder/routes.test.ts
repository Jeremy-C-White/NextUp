import { describe, expect, it } from "vitest";
import { rewriteHlsPlaylistWithToken } from "./routes.js";

describe("transcoder HLS playlist authorization", () => {
  it("adds the session token to MPEG-TS media segments", () => {
    const playlist = "#EXTM3U\n#EXTINF:4,\nsegment_0000.ts\n#EXTINF:4,\nsegment_0001.ts\n";
    const rewritten = rewriteHlsPlaylistWithToken(playlist, "123.a+b");

    expect(rewritten).toContain("segment_0000.ts?token=123.a%2Bb");
    expect(rewritten).toContain("segment_0001.ts?token=123.a%2Bb");
  });

  it("authorizes both the fMP4 initialization file and media segments", () => {
    const playlist = "#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:4,\nsegment_0000.m4s\n";
    const rewritten = rewriteHlsPlaylistWithToken(playlist, "456.token");

    expect(rewritten).toContain('URI="init.mp4?token=456.token"');
    expect(rewritten).toContain("segment_0000.m4s?token=456.token");
  });

  it("adds a cache-busting revision after a server-side seek", () => {
    const playlist = "#EXTM3U\n#EXTINF:4,\nsegment_0000.ts\n";
    const rewritten = rewriteHlsPlaylistWithToken(playlist, "456.token", "seek-2");

    expect(rewritten).toContain("segment_0000.ts?token=456.token&v=seek-2");
  });
});
