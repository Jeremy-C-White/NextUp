import { fetchThroughProxy } from "./webos";

export type IntroDBSegmentType = "intro" | "recap" | "outro";

export interface IntroDBSegment {
  type: IntroDBSegmentType;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  submissionCount: number;
}

export type IntroDBSegments = Partial<Record<IntroDBSegmentType, IntroDBSegment>>;

type RawIntroDBSegment = {
  start_sec?: unknown;
  end_sec?: unknown;
  start_ms?: unknown;
  end_ms?: unknown;
  confidence?: unknown;
  submission_count?: unknown;
};

const INTRODB_API_URL = "https://api.introdb.app/segments";
const segmentCache = new Map<string, IntroDBSegments>();
const SEGMENT_TYPES: IntroDBSegmentType[] = ["recap", "intro", "outro"];

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function parseSegment(type: IntroDBSegmentType, value: unknown): IntroDBSegment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as RawIntroDBSegment;
  const startSeconds = finiteNumber(raw.start_sec) ?? ((finiteNumber(raw.start_ms) ?? Number.NaN) / 1000);
  const endSeconds = finiteNumber(raw.end_sec) ?? ((finiteNumber(raw.end_ms) ?? Number.NaN) / 1000);

  // Reject malformed or implausibly long ranges before they reach the player.
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return undefined;
  if (startSeconds < 0 || endSeconds <= startSeconds || endSeconds - startSeconds > 30 * 60) return undefined;

  return {
    type,
    startSeconds,
    endSeconds,
    confidence: finiteNumber(raw.confidence) ?? 0,
    submissionCount: Math.max(0, Math.floor(finiteNumber(raw.submission_count) ?? 0))
  };
}

export function parseIntroDBResponse(payload: unknown): IntroDBSegments {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;

  return SEGMENT_TYPES.reduce<IntroDBSegments>((segments, type) => {
    const segment = parseSegment(type, record[type]);
    if (segment) segments[type] = segment;
    return segments;
  }, {});
}

export async function getIntroDBSegments(
  imdbId: string,
  season: number,
  episode: number,
  signal?: AbortSignal
): Promise<IntroDBSegments> {
  const normalizedImdbId = imdbId.trim();
  if (!/^tt\d+$/i.test(normalizedImdbId) || season < 0 || episode < 0) return {};

  const cacheKey = `${normalizedImdbId.toLowerCase()}:${season}:${episode}`;
  const cached = segmentCache.get(cacheKey);
  if (cached) return cached;

  const url = new URL(INTRODB_API_URL);
  url.searchParams.set("imdb_id", normalizedImdbId);
  url.searchParams.set("season", String(season));
  url.searchParams.set("episode", String(episode));

  const response = await fetchThroughProxy(url.toString(), signal);
  if (response.status === 404) {
    segmentCache.set(cacheKey, {});
    return {};
  }
  if (!response.ok) throw new Error(`IntroDB lookup failed (HTTP ${response.status}).`);

  const segments = parseIntroDBResponse(await response.json());
  segmentCache.set(cacheKey, segments);
  return segments;
}

export function findActiveIntroDBSegment(
  segments: IntroDBSegments,
  currentTime: number,
  duration: number,
  ignoredTypes: ReadonlySet<IntroDBSegmentType> = new Set()
): IntroDBSegment | null {
  if (!Number.isFinite(currentTime) || currentTime < 0) return null;

  const durationIsKnown = Number.isFinite(duration) && duration > 0;
  const ordered = SEGMENT_TYPES
    .map(type => segments[type])
    .filter((segment): segment is IntroDBSegment => Boolean(segment))
    .sort((left, right) => left.startSeconds - right.startSeconds);

  return ordered.find(segment => {
    if (ignoredTypes.has(segment.type)) return false;
    if (durationIsKnown && segment.startSeconds >= duration) return false;
    const visibleEnd = durationIsKnown ? Math.min(segment.endSeconds, duration) : segment.endSeconds;
    return currentTime >= Math.max(0, segment.startSeconds - 1) && currentTime < visibleEnd - 0.5;
  }) || null;
}
