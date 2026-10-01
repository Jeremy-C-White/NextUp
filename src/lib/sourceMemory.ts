import { PlaybackCandidate } from "../types";

export interface SourceFingerprintInput {
  infoHash?: string;
  fileIdx?: number;
  filename?: string;
  sizeBytes?: number;
}

export type SourceFailureReason = "invalid" | "startup-timeout" | "media-error";

export interface SourcePreference {
  fingerprint: string;
  infoHash?: string;
  bingeGroup?: string;
  releaseName?: string;
  provider?: string;
  quality?: string;
  videoCodec?: string;
  savedAt: number;
}

export interface SourcePenalty {
  failedAt: number;
  reason: SourceFailureReason;
}

export interface SourceMemorySnapshot {
  preferred: SourcePreference | null;
  penalties: Record<string, SourcePenalty>;
}

export interface SourceAffinityHint {
  fingerprint?: string;
  infoHash?: string;
  bingeGroup?: string;
  releaseName?: string;
  provider?: string;
  quality?: string;
  videoCodec?: string;
}

interface SourceAffinityInput extends SourceAffinityHint {
  filename?: string;
  title?: string;
}

export interface SourceAffinityOptions {
  protectedFingerprint?: string;
  penalties?: Record<string, SourcePenalty>;
  now?: number;
}

export interface SourceFailureObservation {
  observedMs?: number;
  sourceProven?: boolean;
  browserOnline?: boolean;
}

export type SourceFailurePenaltyDecisionReason =
  | "eligible"
  | "browser-offline"
  | "source-already-proven"
  | "observation-window-too-short";

export interface SourceFailurePenaltyDecision {
  record: boolean;
  reason: SourceFailurePenaltyDecisionReason;
}

export type SourceAffinityStrategy =
  | "season-pack-info-hash"
  | "stremio-binge-group"
  | "release-similarity";

export interface SourceAffinityResult {
  candidates: PlaybackCandidate[];
  match: {
    strategy: SourceAffinityStrategy;
    fromIndex: number;
  } | null;
}

export interface SourceMemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PREFIX = "nextup_source_memory_v1";
const MAX_PREFERENCE_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const STARTUP_TIMEOUT_TTL_MS = 60 * 60 * 1000;
const MEDIA_ERROR_TTL_MS = 3 * 60 * 60 * 1000;
const INVALID_SOURCE_TTL_MS = 24 * 60 * 60 * 1000;
export const MINIMUM_SOURCE_FAILURE_OBSERVATION_MS = 7_000;

function emptySnapshot(): SourceMemorySnapshot {
  return { preferred: null, penalties: {} };
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeFilename(value?: string): string | undefined {
  const compact = optionalText(value)?.replace(/\s+/g, " ").toLowerCase();
  if (!compact || compact === "unknown stream") return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(compact)) return undefined;
  return compact.split(/[?#]/, 1)[0] || undefined;
}

function safePersistentDescriptor(value: unknown): string | undefined {
  const descriptor = optionalText(value);
  if (!descriptor || /^[a-z][a-z0-9+.-]*:\/\//i.test(descriptor)) return undefined;
  if (/[?&](?:token|auth|key|signature|expires)=/i.test(descriptor)) return undefined;
  return descriptor;
}

function normalizeInfoHash(value?: string): string | undefined {
  const compact = optionalText(value)?.toLowerCase();
  return compact && /^[a-f0-9]{32,64}$/i.test(compact) ? compact : undefined;
}

export function getSourceFingerprint(source: SourceFingerprintInput): string | undefined {
  const infoHash = normalizeInfoHash(source.infoHash);
  if (infoHash) {
    const fileIdx = Number.isInteger(source.fileIdx) && (source.fileIdx || 0) >= 0
      ? source.fileIdx
      : "x";
    return `ih:${infoHash}:${fileIdx}`;
  }

  const filename = normalizeFilename(source.filename);
  if (!filename) return undefined;
  const size = Number.isFinite(source.sizeBytes) && (source.sizeBytes || 0) > 0
    ? Math.floor(source.sizeBytes || 0)
    : "x";
  return `fn:${filename}:${size}`;
}

export function getSourceMediaKey(
  imdbId: string,
  isMovie: boolean,
  season: number,
  episode: number
): string | null {
  const normalizedImdbId = imdbId.trim().toLowerCase();
  if (!/^tt\d+$/.test(normalizedImdbId)) return null;
  if (isMovie) return `movie:${normalizedImdbId}`;
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) return null;
  return `series:${normalizedImdbId}:${season}:${episode}`;
}

export function getSourceShowKey(imdbId: string): string | null {
  const normalizedImdbId = imdbId.trim().toLowerCase();
  return /^tt\d+$/.test(normalizedImdbId) ? `series:${normalizedImdbId}:show` : null;
}

export function getSourceMemoryKey(userId: string, mediaKey: string): string {
  return [STORAGE_PREFIX, userId, mediaKey]
    .map(part => encodeURIComponent(part))
    .join(":");
}

function isValidTimestamp(value: unknown, now: number, maximumAgeMs: number): value is number {
  return Number.isFinite(value)
    && (value as number) >= now - maximumAgeMs
    && (value as number) <= now + MAX_FUTURE_CLOCK_SKEW_MS;
}

function failureTtl(reason: SourceFailureReason): number {
  if (reason === "invalid") return INVALID_SOURCE_TTL_MS;
  if (reason === "media-error") return MEDIA_ERROR_TTL_MS;
  return STARTUP_TIMEOUT_TTL_MS;
}

export function isSourcePenaltyActive(penalty: SourcePenalty | undefined, now = Date.now()): boolean {
  return Boolean(
    penalty
    && ["invalid", "startup-timeout", "media-error"].includes(penalty.reason)
    && isValidTimestamp(penalty.failedAt, now, failureTtl(penalty.reason))
  );
}

function parsePreference(value: unknown, now: number): SourcePreference | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SourcePreference>;
  const fingerprint = optionalText(candidate.fingerprint);
  if (!fingerprint || !isValidTimestamp(candidate.savedAt, now, MAX_PREFERENCE_AGE_MS)) return null;

  return {
    fingerprint,
    infoHash: normalizeInfoHash(candidate.infoHash),
    bingeGroup: optionalText(candidate.bingeGroup),
    releaseName: safePersistentDescriptor(candidate.releaseName),
    provider: optionalText(candidate.provider),
    quality: optionalText(candidate.quality),
    videoCodec: optionalText(candidate.videoCodec),
    savedAt: candidate.savedAt
  };
}

function parsePenalties(value: unknown, now: number): Record<string, SourcePenalty> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([fingerprint, rawPenalty]) => {
      if (!fingerprint || !rawPenalty || typeof rawPenalty !== "object") return [];
      const candidate = rawPenalty as Partial<SourcePenalty>;
      if (
        candidate.reason !== "invalid"
        && candidate.reason !== "startup-timeout"
        && candidate.reason !== "media-error"
      ) return [];
      const penalty: SourcePenalty = { failedAt: candidate.failedAt || 0, reason: candidate.reason };
      return isSourcePenaltyActive(penalty, now) ? [[fingerprint, penalty]] : [];
    })
  );
}

export function readSourceMemory(
  storage: SourceMemoryStorage,
  userId: string,
  mediaKey: string,
  now = Date.now()
): SourceMemorySnapshot {
  const key = getSourceMemoryKey(userId, mediaKey);
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return emptySnapshot();
    const parsed = JSON.parse(serialized) as { preferred?: unknown; penalties?: unknown };
    return {
      preferred: parsePreference(parsed?.preferred, now),
      penalties: parsePenalties(parsed?.penalties, now)
    };
  } catch {
    try { storage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    return emptySnapshot();
  }
}

function writeSnapshot(
  storage: SourceMemoryStorage,
  userId: string,
  mediaKey: string,
  snapshot: SourceMemorySnapshot
): boolean {
  try {
    storage.setItem(getSourceMemoryKey(userId, mediaKey), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function saveSourcePreference(
  storage: SourceMemoryStorage,
  userId: string,
  mediaKey: string,
  candidate: PlaybackCandidate,
  now = Date.now()
): boolean {
  if (!candidate.fingerprint) return false;
  const current = readSourceMemory(storage, userId, mediaKey, now);
  const penalties = { ...current.penalties };
  delete penalties[candidate.fingerprint];

  return writeSnapshot(storage, userId, mediaKey, {
    preferred: {
      fingerprint: candidate.fingerprint,
      infoHash: normalizeInfoHash(candidate.infoHash),
      bingeGroup: optionalText(candidate.bingeGroup),
      releaseName: safePersistentDescriptor(candidate.releaseName),
      provider: optionalText(candidate.provider),
      quality: optionalText(candidate.quality),
      videoCodec: optionalText(candidate.videoCodec),
      savedAt: now
    },
    penalties
  });
}

export function recordSourceFailure(
  storage: SourceMemoryStorage,
  userId: string,
  mediaKey: string,
  fingerprint: string | undefined,
  reason: SourceFailureReason,
  now = Date.now()
): boolean {
  if (!fingerprint) return false;
  const current = readSourceMemory(storage, userId, mediaKey, now);
  return writeSnapshot(storage, userId, mediaKey, {
    preferred: current.preferred,
    penalties: {
      ...current.penalties,
      [fingerprint]: { failedAt: now, reason }
    }
  });
}

export function getSourceFailurePenaltyDecision(
  reason: SourceFailureReason,
  observation: SourceFailureObservation = {}
): SourceFailurePenaltyDecision {
  // navigator.onLine is only a hint, so use it conservatively: never block
  // playback with it, but avoid blaming a source during a known outage.
  if (observation.browserOnline === false) {
    return { record: false, reason: "browser-offline" };
  }
  if (observation.sourceProven) {
    return { record: false, reason: "source-already-proven" };
  }
  if (
    reason === "startup-timeout"
    && observation.observedMs !== undefined
    && observation.observedMs < MINIMUM_SOURCE_FAILURE_OBSERVATION_MS
  ) {
    return { record: false, reason: "observation-window-too-short" };
  }
  return { record: true, reason: "eligible" };
}

export function shouldRecordSourceFailurePenalty(
  reason: SourceFailureReason,
  observation: SourceFailureObservation = {}
): boolean {
  return getSourceFailurePenaltyDecision(reason, observation).record;
}

export function applySourceMemory(
  candidates: PlaybackCandidate[],
  memory: SourceMemorySnapshot | null,
  now = Date.now()
): PlaybackCandidate[] {
  if (!memory || candidates.length < 2) return [...candidates];
  const preferredFingerprint = memory.preferred?.fingerprint;

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      tier: isSourcePenaltyActive(
        candidate.fingerprint ? memory.penalties[candidate.fingerprint] : undefined,
        now
      )
        ? 2
        : candidate.fingerprint && candidate.fingerprint === preferredFingerprint
          ? 0
          : 1
    }))
    .sort((left, right) => left.tier - right.tier || left.index - right.index)
    .map(item => item.candidate);
}

export function isRememberedCandidate(
  candidate: PlaybackCandidate | undefined,
  memory: SourceMemorySnapshot | null,
  now = Date.now()
): boolean {
  if (!candidate?.fingerprint || candidate.fingerprint !== memory?.preferred?.fingerprint) return false;
  return !isSourcePenaltyActive(memory.penalties[candidate.fingerprint], now);
}

export function createSourceAffinityHint(candidate: SourceAffinityInput | null | undefined): SourceAffinityHint | null {
  if (!candidate) return null;
  const hint: SourceAffinityHint = {
    fingerprint: optionalText(candidate.fingerprint),
    infoHash: normalizeInfoHash(candidate.infoHash),
    bingeGroup: optionalText(candidate.bingeGroup),
    releaseName: optionalText(candidate.releaseName || candidate.filename || candidate.title),
    provider: optionalText(candidate.provider),
    quality: optionalText(candidate.quality),
    videoCodec: optionalText(candidate.videoCodec)
  };
  return Object.values(hint).some(Boolean) ? hint : null;
}

function releaseGroup(value?: string): string | undefined {
  const name = optionalText(value)?.replace(/\.[a-z0-9]{2,5}$/i, "");
  const match = name?.match(/-([a-z0-9][a-z0-9._]{1,20})$/i);
  return match?.[1]?.toLowerCase();
}

function releaseTokens(value?: string): Set<string> {
  const normalized = optionalText(value)
    ?.toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\bs\d{1,2}e\d{1,3}\b/g, " ")
    .replace(/\b\d{1,2}x\d{1,3}\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return new Set();
  return new Set(normalized.split(/\s+/).filter(token => token.length > 1));
}

function releaseSource(value?: string): string | undefined {
  const normalized = optionalText(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!normalized) return undefined;
  if (normalized.includes("remux")) return "remux";
  if (normalized.includes("bluray") || normalized.includes("bdrip")) return "bluray";
  if (normalized.includes("webdl")) return "web-dl";
  if (normalized.includes("webrip")) return "webrip";
  if (normalized.includes("hdtv")) return "hdtv";
  return undefined;
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach(token => {
    if (right.has(token)) intersection += 1;
  });
  return intersection / new Set([...left, ...right]).size;
}

function releaseAffinityScore(candidate: PlaybackCandidate, hint: SourceAffinityHint): number | null {
  const candidateName = candidate.releaseName || candidate.filename || candidate.title;
  const candidateGroup = releaseGroup(candidateName);
  const hintGroup = releaseGroup(hint.releaseName);
  const sameGroup = Boolean(candidateGroup && hintGroup && candidateGroup === hintGroup);
  const similarity = tokenSimilarity(releaseTokens(candidateName), releaseTokens(hint.releaseName));
  const candidateSource = releaseSource(candidateName);
  const hintSource = releaseSource(hint.releaseName);
  const sameSource = Boolean(candidateSource && hintSource && candidateSource === hintSource);
  const sameQuality = Boolean(candidate.quality && hint.quality && candidate.quality === hint.quality);
  const sameCodec = Boolean(candidate.videoCodec && hint.videoCodec && candidate.videoCodec === hint.videoCodec);

  // Avoid matching on a common show title alone. A release group is strongest;
  // otherwise require a very similar filename or matching format characteristics.
  if (!sameGroup && similarity < 0.75 && !(similarity >= 0.5 && sameSource && sameQuality)) return null;

  return (sameGroup ? 12 : 0)
    + (sameSource ? 4 : 0)
    + (sameQuality ? 3 : 0)
    + (sameCodec ? 2 : 0)
    + (candidate.provider && hint.provider && candidate.provider === hint.provider ? 1 : 0)
    + Math.round(similarity * 4);
}

/**
 * Moves the best continuation of a proven source to the front while keeping the
 * addon's existing ranking stable for all other candidates.
 */
export function rankSourceAffinity(
  candidates: PlaybackCandidate[],
  hint: SourceAffinityHint | null,
  options: SourceAffinityOptions = {}
): SourceAffinityResult {
  const ordered = [...candidates];
  if (!hint || ordered.length < 2) return { candidates: ordered, match: null };
  if (options.protectedFingerprint && ordered[0]?.fingerprint === options.protectedFingerprint) {
    return { candidates: ordered, match: null };
  }

  const isEligible = (candidate: PlaybackCandidate): boolean => !isSourcePenaltyActive(
    candidate.fingerprint ? options.penalties?.[candidate.fingerprint] : undefined,
    options.now
  );

  // An identical infoHash identifies the same torrent/season pack. bingeGroup
  // can be intentionally broader (for example, provider plus resolution).
  const exactPackIndex = hint.infoHash
    ? ordered.findIndex(candidate => isEligible(candidate) && normalizeInfoHash(candidate.infoHash) === hint.infoHash)
    : -1;
  const exactBingeIndex = exactPackIndex < 0 && hint.bingeGroup
    ? ordered.findIndex(candidate => isEligible(candidate) && candidate.bingeGroup === hint.bingeGroup)
    : -1;

  let preferredIndex = exactPackIndex >= 0 ? exactPackIndex : exactBingeIndex;
  let strategy: SourceAffinityStrategy | null = exactPackIndex >= 0
    ? "season-pack-info-hash"
    : exactBingeIndex >= 0
      ? "stremio-binge-group"
      : null;
  if (preferredIndex < 0) {
    let preferredScore = -1;
    ordered.forEach((candidate, index) => {
      if (!isEligible(candidate)) return;
      const score = releaseAffinityScore(candidate, hint);
      if (score !== null && score > preferredScore) {
        preferredIndex = index;
        preferredScore = score;
        strategy = "release-similarity";
      }
    });
  }

  if (preferredIndex < 0 || !strategy) return { candidates: ordered, match: null };
  if (preferredIndex > 0) {
    const [preferred] = ordered.splice(preferredIndex, 1);
    ordered.unshift(preferred);
  }
  return {
    candidates: ordered,
    match: { strategy, fromIndex: preferredIndex }
  };
}

export function applySourceAffinity(
  candidates: PlaybackCandidate[],
  hint: SourceAffinityHint | null,
  options: SourceAffinityOptions = {}
): PlaybackCandidate[] {
  return rankSourceAffinity(candidates, hint, options).candidates;
}

