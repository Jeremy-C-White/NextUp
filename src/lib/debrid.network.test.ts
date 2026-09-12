import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { getBestAioStreamsSources, getBestTorrentioStream } from './debrid';

const MOCK_AIO_RESPONSE = {
  streams: [
    {
      name: "Torrentio\n[RD+] 4k",
      title: "Supergirl.S01E01.mkv\n👤 25 💾 1.2 GB ⚙️ Torrentio",
      url: "http://example.com/stream1"
    },
    {
      name: "Torrentio\n[RD download] 1080p",
      title: "Silo.S01E01.mp4\n👤 0 💾 800 MB ⚙️ Torrentio",
      url: "http://example.com/stream2"
    }
  ]
};

describe('AIOStreams Network layer', () => {
  let fetchSpy: any;
  let originalLocalStorage: any;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => store[key] = value,
      removeItem: (key: string) => delete store[key],
      clear: () => Object.keys(store).forEach(key => delete store[key]),
      length: 0,
      key: (i: number) => null,
    } as any;
    
    (global as any).window = { 
      localStorage: global.localStorage,
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout
    };
    
    global.localStorage.setItem("aiostreams_base_url", "https://my.aio.streams");
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.localStorage = originalLocalStorage;
    delete (global as any).window;
  });

  test('requests the same-origin backend proxy route rather than the external domain', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_AIO_RESPONSE,
    });

    await getBestTorrentioStream("tt1234567", 1, 1, "series", undefined, true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestUrl = fetchSpy.mock.calls[0][0];
    expect(requestUrl).toContain("/api/debrid/stream?url=");
    expect(requestUrl).toContain(encodeURIComponent("https://my.aio.streams/stream/series/tt1234567:1:1.json"));
  });

  test('filters foreign-only releases and puts explicit English audio first', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        streams: [
          { name: '[RD+] AIO', title: 'Show.S01E01.Spanish.Audio.2160p.mp4', url: 'https://example.com/spanish.mp4' },
          { name: '[RD+] AIO', title: 'Show.S01E01.English.1080p.mp4', url: 'https://example.com/english.mp4' },
          { name: '[RD+] AIO', title: 'Show.S01E01.1080p.mp4', url: 'https://example.com/unknown.mp4' }
        ]
      })
    });

    const candidates = await getBestTorrentioStream('tt7654321', 1, 1, 'series', undefined, true);
    expect(candidates[0].audioLanguage).toBe('english');
    expect(candidates.some(candidate => candidate.url.includes('spanish'))).toBe(false);
  });

  test('returns the complete browser-compatible AIOStreams source pool', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        streams: Array.from({ length: 32 }, (_, index) => ({
          name: '[RD+] AIOStreams',
          title: `Show.S01E01.English.1080p.H264.AAC.source-${index}.mp4`,
          url: `https://example.com/source-${index}.mp4`
        }))
      })
    });

    const candidates = await getBestAioStreamsSources('tt7654333', 1, 1, 'series', undefined, true);
    expect(candidates).toHaveLength(32);
  });

  test('does not intentionally play a source labelled only as non-English', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        streams: [
          { name: '[RD+] AIO', title: 'Show.S01E01.Japanese.Audio.1080p.mp4', url: 'https://example.com/japanese.mp4' }
        ]
      })
    });

    await expect(getBestTorrentioStream('tt7654322', 1, 1, 'series', undefined, true))
      .rejects.toThrow('No source with English or selectable multilingual audio was found.');
  });

  test('backend 504 produces the timeout message', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 504,
      text: async () => "Timeout",
    });

    await expect(getBestTorrentioStream("tt1234567", 1, 1, "series", undefined, true))
      .rejects.toThrow("Stream resolution timed out. Please check your network connection or configured AIOStreams/Stremio URL in Settings.");
  });

  test('backend 502 produces the provider-connection message', async () => {
    vi.useFakeTimers();
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });

    const promise = getBestTorrentioStream("tt1234567", 1, 1, "series", undefined, true);
    const assertion = expect(promise)
      .rejects.toThrow("Unable to reach stream provider directly. Please check your configured URL in Settings.");

    await vi.advanceTimersByTimeAsync(6_000);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  test('temporary 404 is retried automatically and then succeeds', async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not ready",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_AIO_RESPONSE,
      });

    const promise = getBestTorrentioStream("tt1234567", 1, 1, "series", undefined, true);
    await vi.advanceTimersByTimeAsync(800);

    await expect(promise).resolves.toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('sustained provider-route 404s use the extended recovery window', async () => {
    vi.useFakeTimers();
    let calls = 0;
    fetchSpy.mockImplementation(async () => {
      calls += 1;
      if (calls < 8) {
        return {
          ok: false,
          status: 404,
          text: async () => "Route temporarily unavailable",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => MOCK_AIO_RESPONSE,
      };
    });

    const promise = getBestTorrentioStream("tt1234568", 1, 1, "series", undefined, true);
    const assertion = expect(promise).resolves.toHaveLength(1);
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchSpy).toHaveBeenCalledTimes(8);
  });

  test('an empty warm-up response is retried automatically', async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ streams: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_AIO_RESPONSE,
      });

    const promise = getBestTorrentioStream("tt1234567", 1, 1, "series", undefined, true);
    await vi.advanceTimersByTimeAsync(800);

    await expect(promise).resolves.toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  
  test('cancellation via AbortSignal is respected', async () => {
    const controller = new AbortController();
    
    fetchSpy.mockImplementation(async (url: string, options: any) => {
      return new Promise((_, reject) => {
        options.signal?.addEventListener("abort", () => {
          const err = new Error("AbortError");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = getBestTorrentioStream("tt1234567", 1, 1, "series", controller.signal, true);
    controller.abort();

    await expect(promise).rejects.toThrow("Stream resolution timed out.");
  });
});
