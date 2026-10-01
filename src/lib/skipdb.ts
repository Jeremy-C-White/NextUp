import { IntroDBSegment, IntroDBSegments, IntroDBSegmentType } from "./introdb";
import { fetchThroughProxy } from "./webos";

/**
 * SkipDB (https://skipdb.tv) is an open, crowdsourced skip-timestamp database.
 * NextUp uses it only as a fallback: IntroDB stays primary, and SkipDB fills
 * segment types IntroDB does not have (most often the credits/outro).
 * Data is licensed ODbL 1.0 by SkipDB contributors.
 */
const SKIPDB_API_URL = "https://api.skipdb.tv/api/segments";
const SEGMENT_TYPES: IntroDBSegmentType[] = ["recap", "intro", "outro"];
const MAXIMUM_SEGMENT_SECONDS = 30 * 60;

export type SkipDBMatch = "exact" | "shifted" | "agnostic" | "out-of-range" | "unknown";

export interface SkipDBSegment extends IntroDBSegment {
  match: SkipDBMatch;
}

export type SkipDBSegments = Partial<Record<IntroDBSegmentType, SkipDBSegment>>;

export type SegmentSource = "introdb" | "skipdb";

export interface MergedSkipSegments {
  segments: IntroDBSegments;
  sources: Partial<Record<IntroDBSegmentType, SegmentSource>>;
}

type RawSkipDBSegment = {
  start_ms?: unknown;
  end_ms?: unknown;
  match?: unknown;
  confidence?: unknown;
};

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function parseMatch(value: unknown): SkipDBMatch {
  return value === "exact" || value === "shifted" || value === "agnostic" || value === "out-of-range"
    ? value
    : "unknown";
}

function parseSkipDBSegment(type: IntroDBSegmentType, value: unknown): SkipDBSegment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as RawSkipDBSegment;
  const startMs = finiteNumber(raw.start_ms);
  const endMs = finiteNumber(raw.end_ms);
  if (startMs === null || endMs === null) return undefined;
  // SkipDB uses 0/0 as an explicit "no segment" marker.
  if (startMs === 0 && endMs === 0) return undefined;

  const match = parseMatch(raw.match);
  // SkipDB flags data that could not be aligned to this file's length as
  // uncertain. Never let an uncertain range drive skipping or autoplay.
  if (match === "out-of-range") return undefined;

  const startSeconds = startMs / 1000;
  const endSeconds = endMs / 1000;
  if (startSeconds < 0 || endSeconds <= startSeconds || endSeconds - startSeconds > MAXIMUM_SEGMENT_SECONDS) {
    return undefined;
  }

  return {
    type,
    startSeconds,
    endSeconds,
    confidence: finiteNumber(raw.confidence) ?? 0,
    submissionCount: 0,
    match
  };
}

export function parseSkipDBResponse(payload: unknown): SkipDBSegments {
  if (!payload || typeof payload !== "object") return {};
  const segmentsRecord = (payload as { segments?: unknown }).segments;
  if (!segmentsRecord || typeof segmentsRecord !== "object") return {};
  const record = segmentsRecord as Record<string, unknown>;

  return SEGMENT_TYPES.reduce<SkipDBSegments>((segments, type) => {
    const segment = parseSkipDBSegment(type, record[type]);
    if (segment) segments[type] = segment;
    return segments;
  }, {});
}

export function buildSkipDBUrl(
  imdbId: string,
  season: number,
  episode: number,
  durationSeconds?: number
): string | null {
  const normalizedImdbId = imdbId.trim().toLowerCase();
  if (!/^tt\d+$/.test(normalizedImdbId)) return null;
  if (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 0) return null;

  const url = new URL(SKIPDB_API_URL);
  url.searchParams.set("imdb_id", normalizedImdbId);
  url.searchParams.set("season", String(season));
  url.searchParams.set("episode", String(episode));
  // The stream length lets SkipDB confirm or shift timestamps for this exact
  // release; without it every result is "agnostic".
  if (Number.isFinite(durationSeconds) && (durationSeconds || 0) > 0) {
    url.searchParams.set("duration", String(Math.round(durationSeconds || 0)));
  }
  return url.toString();
}

const skipDBCache = new Map<string, SkipDBSegments>();

export async function getSkipDBSegments(
  imdbId: string,
  season: number,
  episode: number,
  durationSeconds?: number,
  signal?: AbortSignal
): Promise<SkipDBSegments> {
  const url = buildSkipDBUrl(imdbId, season, episode, durationSeconds);
  if (!url) return {};

  const cached = skipDBCache.get(url);
  if (cached) return cached;

  const response = await fetchThroughProxy(url, signal);
  if (response.status === 404) {
    skipDBCache.set(url, {});
    return {};
  }
  if (!response.ok) throw new Error(`SkipDB lookup failed (HTTP ${response.status}).`);

  const segments = parseSkipDBResponse(await response.json());
  skipDBCache.set(url, segments);
  return segments;
}

/** True when IntroDB is missing a segment type SkipDB could provide. */
export function needsSkipDBFallback(primary: IntroDBSegments): boolean {
  return SEGMENT_TYPES.some(type => !primary[type]);
}

/**
 * Keeps every IntroDB segment and only fills the types IntroDB does not have.
 */
export function mergeSkipSegments(
  primary: IntroDBSegments,
  fallback: SkipDBSegments
): MergedSkipSegments {
  const segments: IntroDBSegments = {};
  const sources: MergedSkipSegments["sources"] = {};

  SEGMENT_TYPES.forEach(type => {
    const primarySegment = primary[type];
    if (primarySegment) {
      segments[type] = primarySegment;
      sources[type] = "introdb";
      return;
    }
    const fallbackSegment = fallback[type];
    if (fallbackSegment) {
      const { match: _match, ...segment } = fallbackSegment;
      segments[type] = segment;
      sources[type] = "skipdb";
    }
  });

  return { segments, sources };
}

