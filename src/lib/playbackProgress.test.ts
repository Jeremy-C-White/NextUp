import { describe, expect, it } from "vitest";
import {
  buildPlaybackPercentageIndex,
  clearPlaybackProgress,
  formatPlaybackPosition,
  getPlaybackPercentage,
  getPlaybackProgressKey,
  getResumePosition,
  getSameSessionFailoverPosition,
  PlaybackProgressStorage,
  readPlaybackProgress,
  writePlaybackProgress
} from "./playbackProgress";

class MemoryStorage implements PlaybackProgressStorage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("playback progress", () => {
  const now = Date.UTC(2026, 6, 28, 22, 0, 0);

  it("stores progress separately for each user and episode", () => {
    const storage = new MemoryStorage();
    expect(writePlaybackProgress(storage, "user one", "show/1", "episode:2", 615.9, 2700.7, now)).toBe(true);

    expect(readPlaybackProgress(storage, "user one", "show/1", "episode:2", now)).toEqual({
      position: 615,
      duration: 2700,
      updatedAt: now
    });
    expect(readPlaybackProgress(storage, "user two", "show/1", "episode:2", now)).toBeNull();
    expect(getPlaybackProgressKey("user one", "show/1", "episode:2")).toContain("user%20one");
  });

  it("formats resume positions for clear TV labels", () => {
    expect(formatPlaybackPosition(20)).toBe("0:20");
    expect(formatPlaybackPosition(1394)).toBe("23:14");
    expect(formatPlaybackPosition(3723)).toBe("1:02:03");
    expect(formatPlaybackPosition(Number.NaN)).toBe("0:00");
  });

  it("calculates a visible partial-playback percentage", () => {
    expect(getPlaybackPercentage({ position: 450, duration: 1800, updatedAt: now })).toBe(25);
    expect(getPlaybackPercentage(null)).toBeNull();
    expect(getPlaybackPercentage({ position: 1800, duration: 1800, updatedAt: now })).toBeNull();
  });

  it("indexes the latest partial playback once per show and user", () => {
    const storage = new MemoryStorage();
    writePlaybackProgress(storage, "user one", "show/1", "episode:1", 300, 1200, now - 1000);
    writePlaybackProgress(storage, "user one", "show/1", "episode:2", 900, 1200, now);
    writePlaybackProgress(storage, "user one", "show/2", "episode:1", 600, 1200, now);
    writePlaybackProgress(storage, "user two", "show/1", "episode:3", 120, 1200, now);

    expect(Array.from(buildPlaybackPercentageIndex(storage, "user one", now))).toEqual([
      ["show/1", 75],
      ["show/2", 50]
    ]);
  });

  it("resumes only after a meaningful start and before the ending window", () => {
    expect(getResumePosition({ position: 615, duration: 2700, updatedAt: now })).toBe(615);
    expect(getResumePosition({ position: 20, duration: 2700, updatedAt: now })).toBeNull();
    expect(getResumePosition({ position: 2650, duration: 2700, updatedAt: now })).toBeNull();
  });

  it("checks the actual duration of a fallback source before resuming", () => {
    const progress = { position: 615, duration: 2700, updatedAt: now };
    expect(getResumePosition(progress, 2600)).toBe(615);
    expect(getResumePosition(progress, 700)).toBeNull();
  });

  it("keeps the exact live position when changing sources in the same session", () => {
    expect(getSameSessionFailoverPosition(42, 2700)).toBe(42);
    expect(getSameSessionFailoverPosition(2645, 2700)).toBe(2645);
    expect(getSameSessionFailoverPosition(2800, 2700)).toBe(2699);
    expect(getSameSessionFailoverPosition(0, 2700)).toBeNull();
    expect(getSameSessionFailoverPosition(42, 1)).toBeNull();
  });

  it("removes malformed and expired progress", () => {
    const storage = new MemoryStorage();
    const key = getPlaybackProgressKey("user", "show", "episode");
    storage.setItem(key, "not-json");
    expect(readPlaybackProgress(storage, "user", "show", "episode", now)).toBeNull();
    expect(storage.getItem(key)).toBeNull();

    storage.setItem(key, JSON.stringify({
      position: 300,
      duration: 1800,
      updatedAt: now - 91 * 24 * 60 * 60 * 1000
    }));
    expect(readPlaybackProgress(storage, "user", "show", "episode", now)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("clears completed or replayed episode progress", () => {
    const storage = new MemoryStorage();
    writePlaybackProgress(storage, "user", "show", "episode", 600, 1800, now);
    clearPlaybackProgress(storage, "user", "show", "episode");
    expect(readPlaybackProgress(storage, "user", "show", "episode", now)).toBeNull();
  });

  it("ignores invalid write values without replacing valid progress", () => {
    const storage = new MemoryStorage();
    writePlaybackProgress(storage, "user", "show", "episode", 600, 1800, now);
    expect(writePlaybackProgress(storage, "user", "show", "episode", 1800, 1800, now)).toBe(false);
    expect(readPlaybackProgress(storage, "user", "show", "episode", now)?.position).toBe(600);
  });
});
