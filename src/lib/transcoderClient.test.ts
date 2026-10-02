import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscoderClient } from "./transcoderClient";

describe("TranscoderClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only the real transcoder health response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok", service: "nextup-transcoder" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>app fallback</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TranscoderClient();

    await expect(client.isHealthy()).resolves.toBe(true);
    await expect(client.isHealthy()).resolves.toBe(false);
  });

  it("starts a same-origin session without exposing the source in the request URL", async () => {
    const response = {
      sessionId: "s1",
      token: "token",
      streamUrl: "/api/transcode/session/s1/index.m3u8?token=token",
      segmentType: "mpegts",
      videoCodec: "h264",
      isCopied: true,
      durationSeconds: 1200,
      audioStreams: [],
      subtitleStreams: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TranscoderClient();

    await expect(client.startSession({ sourceUrl: "https://download.real-debrid.com/video.mkv", startTime: 90 }))
      .resolves.toMatchObject({ sessionId: "s1", isCopied: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/transcode/session", expect.objectContaining({ method: "POST" }));
    const request = fetchMock.mock.calls[0][1];
    expect(request.body).toContain('"startTime":90');
  });
});
