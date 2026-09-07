import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchThroughProxy } from "./webos";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchThroughProxy", () => {
  it("calls the provider directly on GitHub Pages", async () => {
    const targetUrl = "https://provider.example.com/manifest.json";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("window", {
      location: { protocol: "https:", hostname: "jeremy-c-white.github.io" }
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchThroughProxy(targetUrl);

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(targetUrl);
  });

  it("falls back to the direct provider when the server route is unavailable", async () => {
    const targetUrl = "https://provider.example.com/stream.json";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" }
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchThroughProxy(targetUrl);

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(targetUrl);
  });
});
