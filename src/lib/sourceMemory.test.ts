import { describe, expect, it } from "vitest";
import { PlaybackCandidate } from "../types";
import {
  applySourceAffinity,
  applySourceMemory,
  createSourceAffinityHint,
  getSourceFingerprint,
  getSourceFailurePenaltyDecision,
  getSourceMediaKey,
  getSourceShowKey,
  getSourceMemoryKey,
  readSourceMemory,
  recordSourceFailure,
  rankSourceAffinity,
  saveSourcePreference,
  shouldRecordSourceFailurePenalty,
  SourceMemoryStorage,
  SourceMemorySnapshot
} from "./sourceMemory";

class MemoryStorage implements SourceMemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const candidate = (name: string, fingerprint?: string): PlaybackCandidate => ({
  id: name,
  url: `https://media.example/${name}?token=secret`,
  title: name,
  fingerprint,
  container: "web-compatible",
  score: 100
});

describe("source fingerprints", () => {
  it("uses a lowercased info hash and file index without leaking the URL", () => {
    const fingerprint = getSourceFingerprint({
      infoHash: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
      fileIdx: 3,
      filename: "Episode.mkv"
    });
    expect(fingerprint).toBe("ih:abcdef0123456789abcdef0123456789abcdef01:3");
    expect(fingerprint).not.toContain("http");
    expect(fingerprint).not.toContain("token");
  });

  it("falls back to a normalized filename and exact byte size", () => {
    expect(getSourceFingerprint({
      filename: "  Show.S01E02   1080p.mkv  ",
      sizeBytes: 1_234_567
    })).toBe("fn:show.s01e02 1080p.mkv:1234567");
  });

  it("never treats a direct URL as a filename fingerprint", () => {
    expect(getSourceFingerprint({
      filename: "https://debrid.example/file.mkv?token=secret",
      sizeBytes: 123
    })).toBeUndefined();
  });
});

describe("source-memory persistence", () => {
  const now = Date.UTC(2026, 8, 26, 12, 0, 0);
  const mediaKey = getSourceMediaKey("tt1234567", false, 1, 2)!;

  it("stores preferences separately for each user and title", () => {
    const storage = new MemoryStorage();
    const preferred = {
      ...candidate("preferred", "ih:abcdef0123456789abcdef0123456789abcdef01:2"),
      bingeGroup: "addon-1080p",
      releaseName: "Show.S01E02.1080p.WEB-DL-GROUP"
    };

    expect(saveSourcePreference(storage, "user one", mediaKey, preferred, now)).toBe(true);
    expect(readSourceMemory(storage, "user one", mediaKey, now).preferred).toMatchObject({
      fingerprint: preferred.fingerprint,
      bingeGroup: "addon-1080p"
    });
    expect(readSourceMemory(storage, "user two", mediaKey, now).preferred).toBeNull();
    expect(getSourceMemoryKey("user one", mediaKey)).toContain("user%20one");
  });

  it("creates one stable preference key for an entire series", () => {
    expect(getSourceShowKey("TT1234567")).toBe("series:tt1234567:show");
    expect(getSourceShowKey("not-imdb")).toBeNull();
  });

  it("does not persist a URL accidentally supplied as release metadata", () => {
    const storage = new MemoryStorage();
    const preferred = {
      ...candidate("preferred", "fn:preferred.mkv:2"),
      releaseName: "https://debrid.example/file.mkv?token=secret"
    };

    expect(saveSourcePreference(storage, "user", mediaKey, preferred, now)).toBe(true);
    const serialized = [...storage.values.values()].join("");
    expect(serialized).not.toContain("debrid.example");
    expect(serialized).not.toContain("secret");
  });

  it("keeps invalid-source penalties longer than startup timeouts", () => {
    const storage = new MemoryStorage();
    const invalid = "fn:invalid.mkv:100";
    const timeout = "fn:timeout.mkv:200";
    recordSourceFailure(storage, "user", mediaKey, invalid, "invalid", now);
    recordSourceFailure(storage, "user", mediaKey, timeout, "startup-timeout", now);

    const fourHoursLater = now + 4 * 60 * 60 * 1000;
    const memory = readSourceMemory(storage, "user", mediaKey, fourHoursLater);
    expect(memory.penalties[invalid]).toBeDefined();
    expect(memory.penalties[timeout]).toBeUndefined();
  });

  it("expires startup timeouts after one hour while retaining media errors for three", () => {
    const storage = new MemoryStorage();
    const timeout = "fn:timeout.mkv:200";
    const mediaError = "fn:media-error.mkv:300";
    recordSourceFailure(storage, "user", mediaKey, timeout, "startup-timeout", now);
    recordSourceFailure(storage, "user", mediaKey, mediaError, "media-error", now);

    const ninetyMinutesLater = readSourceMemory(
      storage,
      "user",
      mediaKey,
      now + 90 * 60 * 1000
    );
    expect(ninetyMinutesLater.penalties[timeout]).toBeUndefined();
    expect(ninetyMinutesLater.penalties[mediaError]).toBeDefined();
  });
});

describe("source-memory ordering", () => {
  const now = Date.UTC(2026, 8, 26, 12, 0, 0);
  const first = candidate("first", "fn:first.mkv:1");
  const remembered = candidate("remembered", "fn:remembered.mkv:2");
  const last = candidate("last", "fn:last.mkv:3");

  const memory = (overrides: Partial<SourceMemorySnapshot> = {}): SourceMemorySnapshot => ({
    preferred: {
      fingerprint: remembered.fingerprint!,
      releaseName: remembered.title,
      savedAt: now
    },
    penalties: {},
    ...overrides
  });

  it("moves an unpenalized remembered source to the front", () => {
    expect(applySourceMemory([first, remembered, last], memory(), now).map(item => item.id))
      .toEqual(["remembered", "first", "last"]);
  });

  it("preserves provider order when there is no match", () => {
    const noMatch = memory({ preferred: { fingerprint: "fn:missing.mkv:4", savedAt: now } });
    expect(applySourceMemory([first, remembered, last], noMatch, now).map(item => item.id))
      .toEqual(["first", "remembered", "last"]);
  });

  it("moves a penalized remembered source to the end", () => {
    const penalized = memory({
      penalties: {
        [remembered.fingerprint!]: { failedAt: now, reason: "startup-timeout" }
      }
    });
    expect(applySourceMemory([first, remembered, last], penalized, now).map(item => item.id))
      .toEqual(["first", "last", "remembered"]);
  });

  it("ignores an expired transient penalty", () => {
    const expired = memory({
      penalties: {
        [first.fingerprint!]: { failedAt: now - 4 * 60 * 60 * 1000, reason: "media-error" }
      }
    });
    expect(applySourceMemory([first, remembered, last], expired, now).map(item => item.id))
      .toEqual(["remembered", "first", "last"]);
  });
});

describe("next-episode source affinity", () => {
  const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const prior = {
    ...candidate("prior", "ih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1"),
    infoHash: hashA,
    fileIdx: 1,
    bingeGroup: "show-web-ntb",
    releaseName: "Example.Show.S01E01.1080p.WEB-DL.DDP5.1.H.264-NTb",
    quality: "1080p",
    videoCodec: "h264",
    provider: "AIOStreams"
  };

  it("prefers the exact torrent pack over a broader binge group", () => {
    const pack = { ...candidate("pack"), infoHash: hashA };
    const binge = { ...candidate("binge"), bingeGroup: prior.bingeGroup };
    const result = rankSourceAffinity([pack, binge], createSourceAffinityHint(prior));
    expect(result.candidates.map(item => item.id)).toEqual(["pack", "binge"]);
    expect(result.match).toEqual({ strategy: "season-pack-info-hash", fromIndex: 0 });
  });

  it("reports binge-group matching when no exact torrent pack exists", () => {
    const unrelated = { ...candidate("unrelated"), infoHash: hashB };
    const binge = { ...candidate("binge"), bingeGroup: prior.bingeGroup };
    const hint = createSourceAffinityHint({ ...prior, infoHash: undefined });
    const result = rankSourceAffinity([unrelated, binge], hint);
    expect(result.candidates.map(item => item.id)).toEqual(["binge", "unrelated"]);
    expect(result.match).toEqual({ strategy: "stremio-binge-group", fromIndex: 1 });
  });

  it("uses the same torrent pack when bingeGroup is unavailable", () => {
    const unrelated = { ...candidate("unrelated"), infoHash: hashB };
    const samePack = { ...candidate("same-pack"), infoHash: hashA };
    expect(applySourceAffinity([unrelated, samePack], createSourceAffinityHint({ ...prior, bingeGroup: undefined })).map(item => item.id))
      .toEqual(["same-pack", "unrelated"]);
  });

  it("can match the next filename from the same release group", () => {
    const unrelated = {
      ...candidate("unrelated"),
      releaseName: "Example.Show.S01E02.720p.HDTV.x264-OTHER",
      quality: "720p",
      videoCodec: "h264"
    };
    const continuation = {
      ...candidate("continuation"),
      releaseName: "Example.Show.S01E02.1080p.WEB-DL.DDP5.1.H.264-NTb",
      quality: "1080p",
      videoCodec: "h264"
    };
    const hint = createSourceAffinityHint({ ...prior, infoHash: undefined, bingeGroup: undefined });
    const result = rankSourceAffinity([unrelated, continuation], hint);
    expect(result.candidates.map(item => item.id)).toEqual(["continuation", "unrelated"]);
    expect(result.match).toEqual({ strategy: "release-similarity", fromIndex: 1 });
  });

  it("does not reorder loosely related release names", () => {
    const first = { ...candidate("first"), releaseName: "Example.Show.S01E02.720p.HDTV-OTHER" };
    const second = { ...candidate("second"), releaseName: "Example.Show.S01E02.2160p.BLURAY-THIRD" };
    const hint = createSourceAffinityHint({ ...prior, infoHash: undefined, bingeGroup: undefined });
    expect(applySourceAffinity([first, second], hint).map(item => item.id))
      .toEqual(["first", "second"]);
  });

  it("never displaces a remembered next-episode source", () => {
    const remembered = { ...candidate("remembered", "fn:remembered:1"), infoHash: hashB };
    const binge = { ...candidate("binge"), bingeGroup: prior.bingeGroup };
    expect(applySourceAffinity(
      [remembered, binge],
      createSourceAffinityHint(prior),
      { protectedFingerprint: remembered.fingerprint }
    ).map(item => item.id)).toEqual(["remembered", "binge"]);
  });

  it("does not promote an actively penalized pack match", () => {
    const now = Date.UTC(2026, 8, 26, 12, 0, 0);
    const safe = { ...candidate("safe", "fn:safe:1"), infoHash: hashB };
    const penalized = {
      ...candidate("penalized", "ih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:2"),
      infoHash: hashA,
      bingeGroup: prior.bingeGroup
    };
    expect(applySourceAffinity(
      [safe, penalized],
      createSourceAffinityHint(prior),
      {
        penalties: {
          [penalized.fingerprint!]: { failedAt: now, reason: "startup-timeout" }
        },
        now
      }
    ).map(item => item.id)).toEqual(["safe", "penalized"]);
  });

  it("can build a show-level hint from a stored preference", () => {
    const hint = createSourceAffinityHint({
      fingerprint: prior.fingerprint,
      infoHash: prior.infoHash,
      bingeGroup: prior.bingeGroup,
      releaseName: prior.releaseName,
      provider: prior.provider,
      quality: prior.quality,
      videoCodec: prior.videoCodec
    });
    expect(hint).toMatchObject({
      infoHash: hashA,
      bingeGroup: "show-web-ntb",
      quality: "1080p"
    });
  });
});

describe("source-failure penalty policy", () => {
  it("does not penalize a candidate that received less than seven seconds", () => {
    const observation = {
      observedMs: 6_999,
      browserOnline: true
    };
    expect(shouldRecordSourceFailurePenalty("startup-timeout", observation)).toBe(false);
    expect(getSourceFailurePenaltyDecision("startup-timeout", observation).reason)
      .toBe("observation-window-too-short");
  });

  it("penalizes a genuine startup timeout after the full observation window", () => {
    expect(shouldRecordSourceFailurePenalty("startup-timeout", {
      observedMs: 7_000,
      browserOnline: true
    })).toBe(true);
  });

  it("does not penalize a proven source for a later playback failure", () => {
    const observation = {
      sourceProven: true,
      browserOnline: true
    };
    expect(shouldRecordSourceFailurePenalty("media-error", observation)).toBe(false);
    expect(getSourceFailurePenaltyDecision("media-error", observation).reason)
      .toBe("source-already-proven");
  });

  it("does not write any failure penalty while the browser reports offline", () => {
    const observation = {
      browserOnline: false
    };
    expect(shouldRecordSourceFailurePenalty("media-error", observation)).toBe(false);
    expect(getSourceFailurePenaltyDecision("media-error", observation).reason)
      .toBe("browser-offline");
  });
});

