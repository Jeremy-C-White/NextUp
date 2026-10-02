import { isWebOSTV, requestWebOSService } from "./webos";

const API_BASE = "https://api.opensubtitles.com/api/v1";
const API_KEY_STORAGE_KEY = "nextup_opensubtitles_api_key";
const BUILT_IN_API_KEY = "kS2PVWP9IGKeTnZx8yPjXpvqdJUoJGh7";
const SUBTITLE_CACHE_KEY = "nextup_external_subtitle_cache_v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 10;

export interface ExternalSubtitleRequest {
  imdbId: string;
  season?: number;
  episode?: number;
  releaseName?: string;
}

export interface ExternalSubtitle {
  vtt: string;
  fileName: string;
  fromCache: boolean;
}

interface OpenSubtitlesFile {
  file_id?: number | string;
  file_name?: string;
}

export interface OpenSubtitlesSearchItem {
  id?: string;
  attributes?: {
    language?: string;
    hearing_impaired?: boolean;
    from_trusted?: boolean;
    ai_translated?: boolean;
    machine_translated?: boolean;
    foreign_parts_only?: boolean;
    hd?: boolean;
    ratings?: number;
    download_count?: number;
    release?: string;
    files?: OpenSubtitlesFile[];
  };
}

interface CachedSubtitle extends ExternalSubtitle {
  key: string;
  savedAt: number;
}

export class OpenSubtitlesError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "OpenSubtitlesError";
    this.status = status;
  }
}

export function isValidOpenSubtitlesApiKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,128}$/.test(value.trim());
}

export function getOpenSubtitlesApiKey(): string {
  if (typeof window === "undefined") return BUILT_IN_API_KEY;
  try {
    const value = window.localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    return isValidOpenSubtitlesApiKey(value) ? value.trim() : BUILT_IN_API_KEY;
  } catch {
    return BUILT_IN_API_KEY;
  }
}

export function saveOpenSubtitlesApiKey(value: string): void {
  if (typeof window === "undefined") return;
  const normalized = value.trim();
  try {
    if (!normalized) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      return;
    }
    if (!isValidOpenSubtitlesApiKey(normalized)) {
      throw new Error("The OpenSubtitles API key format is not valid.");
    }
    window.localStorage.setItem(API_KEY_STORAGE_KEY, normalized);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("The OpenSubtitles API key could not be saved.");
  }
}

function parseLaunchDetails(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function applyLaunchConfiguration(value: unknown): void {
  const details = parseLaunchDetails(value);
  const apiKey = details?.openSubtitlesApiKey;
  if (typeof apiKey !== "string" || !isValidOpenSubtitlesApiKey(apiKey)) return;
  saveOpenSubtitlesApiKey(apiKey);
}

export function installOpenSubtitlesLaunchConfigListener(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const handleLaunch = (event: Event) => {
    applyLaunchConfiguration((event as CustomEvent).detail);
  };

  document.addEventListener("webOSLaunch", handleLaunch);
  document.addEventListener("webOSRelaunch", handleLaunch);
  applyLaunchConfiguration(window.PalmSystem?.launchParams);
}

function extractApiError(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // The service can return plain text for a provider error.
  }
  return fallback;
}

async function requestOpenSubtitles(
  method: "openSubtitlesSearch" | "openSubtitlesDownload",
  parameters: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ body: string; fileName?: string }> {
  if (isWebOSTV()) {
    const response = await requestWebOSService(method, parameters, signal);
    const status = typeof response.status === "number" ? response.status : response.ok === false ? 502 : 200;
    const body = typeof response.body === "string" ? response.body : "";
    if (response.ok === false || status < 200 || status >= 300) {
      throw new OpenSubtitlesError(extractApiError(body, `OpenSubtitles request failed (HTTP ${status}).`), status);
    }
    return {
      body,
      fileName: typeof response.fileName === "string" ? response.fileName : undefined
    };
  }

  const apiKey = String(parameters.apiKey || "");
  if (method === "openSubtitlesSearch") {
    const query = new URLSearchParams();
    if (parameters.episodeNumber) query.set("episode_number", String(parameters.episodeNumber));
    query.set("imdb_id", String(parameters.imdbId || ""));
    query.set("languages", "en");
    query.set("order_by", "download_count");
    query.set("order_direction", "desc");
    if (parameters.seasonNumber) query.set("season_number", String(parameters.seasonNumber));
    const response = await fetch(`${API_BASE}/subtitles?${query.toString()}`, {
      headers: { Accept: "application/json", "Api-Key": apiKey, "User-Agent": "NextUpTV v1.0.50" },
      signal
    });
    const body = await response.text();
    if (!response.ok) throw new OpenSubtitlesError(extractApiError(body, `OpenSubtitles search failed (HTTP ${response.status}).`), response.status);
    return { body };
  }

  const ticketResponse = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "User-Agent": "NextUpTV v1.0.50"
    },
    body: JSON.stringify({ file_id: parameters.fileId }),
    signal
  });
  const ticketBody = await ticketResponse.text();
  if (!ticketResponse.ok) {
    throw new OpenSubtitlesError(extractApiError(ticketBody, `OpenSubtitles download failed (HTTP ${ticketResponse.status}).`), ticketResponse.status);
  }
  const ticket = JSON.parse(ticketBody);
  if (typeof ticket?.link !== "string") throw new OpenSubtitlesError("OpenSubtitles did not return a download link.");
  const subtitleResponse = await fetch(ticket.link, { signal });
  const body = await subtitleResponse.text();
  if (!subtitleResponse.ok) {
    throw new OpenSubtitlesError(`Subtitle file download failed (HTTP ${subtitleResponse.status}).`, subtitleResponse.status);
  }
  return { body, fileName: typeof ticket.file_name === "string" ? ticket.file_name : undefined };
}

function releaseTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 1)
  );
}

function tokenMatchScore(candidate: string, releaseName: string): number {
  if (!candidate || !releaseName) return 0;
  const left = releaseTokens(candidate);
  const right = releaseTokens(releaseName);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach(token => {
    if (right.has(token)) intersection++;
  });
  return (intersection / Math.max(left.size, right.size)) * 100;
}

export function chooseBestOpenSubtitlesFile(
  items: OpenSubtitlesSearchItem[],
  releaseName = ""
): { fileId: string; fileName: string } | null {
  let best: { fileId: string; fileName: string; score: number } | null = null;

  items.forEach(item => {
    const attributes = item.attributes || {};
    if (attributes.language && attributes.language !== "en") return;
    const file = attributes.files?.find(entry => entry.file_id !== undefined && entry.file_id !== null);
    if (!file) return;

    const fileName = file.file_name || attributes.release || "English.srt";
    const release = [attributes.release, fileName].filter(Boolean).join(" ");
    let score = tokenMatchScore(release, releaseName);
    if (attributes.from_trusted) score += 18;
    if (attributes.hearing_impaired) score += 8;
    if (attributes.hd) score += 2;
    if (attributes.ai_translated) score -= 25;
    if (attributes.machine_translated) score -= 40;
    if (attributes.foreign_parts_only) score -= 70;
    score += Math.min(10, Math.max(0, Number(attributes.ratings) || 0));
    score += Math.min(12, Math.log10(Math.max(1, Number(attributes.download_count) || 1)) * 3);

    if (!best || score > best.score) {
      best = { fileId: String(file.file_id), fileName, score };
    }
  });

  return best ? { fileId: best.fileId, fileName: best.fileName } : null;
}

export function srtToWebVtt(input: string): string {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return `${normalized}\n`;

  const converted = normalized
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/<\/?font(?:\s+[^>]*)?>/gi, "");

  if (!/\d{1,2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{1,2}:\d{2}:\d{2}\.\d{3}/.test(converted)) {
    throw new Error("The downloaded subtitle file was not valid SRT or WebVTT.");
  }
  return `WEBVTT\n\n${converted}\n`;
}

function parseWebVttTimestamp(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.some(part => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function formatWebVttTimestamp(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

/**
 * A restarted HLS session begins its media timeline at zero. Shift cached
 * full-title captions by the same source offset so Safari displays the right
 * cue after resume, skip-intro, or scrubbing.
 */
export function shiftWebVttForPlaybackOffset(input: string, offsetSeconds: number): string {
  const offset = Math.max(0, Number.isFinite(offsetSeconds) ? offsetSeconds : 0);
  const normalized = input.replace(/\r\n?/g, "\n").trim();
  if (offset === 0 || !normalized) return `${normalized}\n`;

  const timingPattern = /((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})([^\n]*)/;
  const shiftedBlocks = normalized.split(/\n{2,}/).flatMap(block => {
    const timing = block.match(timingPattern);
    if (!timing) return [block];

    const start = parseWebVttTimestamp(timing[1]);
    const end = parseWebVttTimestamp(timing[2]);
    if (end <= offset) return [];

    const shiftedTiming = `${formatWebVttTimestamp(Math.max(0, start - offset))} --> ${formatWebVttTimestamp(end - offset)}${timing[3]}`;
    return [block.replace(timingPattern, shiftedTiming)];
  });

  return `${shiftedBlocks.join("\n\n")}\n`;
}

function buildCacheKey(request: ExternalSubtitleRequest): string {
  const release = Array.from(releaseTokens(request.releaseName || "")).sort().join("-").slice(0, 120);
  return [request.imdbId.toLocaleLowerCase(), request.season || 0, request.episode || 0, release].join(":");
}

function readCache(): CachedSubtitle[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUBTITLE_CACHE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - CACHE_TTL_MS;
    return parsed.filter(entry => entry && typeof entry.key === "string" && typeof entry.vtt === "string" && entry.savedAt >= cutoff);
  } catch {
    return [];
  }
}

function getCachedSubtitle(key: string): ExternalSubtitle | null {
  const cached = readCache().find(entry => entry.key === key);
  return cached ? { vtt: cached.vtt, fileName: cached.fileName, fromCache: true } : null;
}

function cacheSubtitle(key: string, subtitle: ExternalSubtitle): void {
  if (typeof window === "undefined") return;
  const next: CachedSubtitle[] = [
    { ...subtitle, key, fromCache: false, savedAt: Date.now() },
    ...readCache().filter(entry => entry.key !== key)
  ].slice(0, MAX_CACHE_ENTRIES);

  try {
    window.localStorage.setItem(SUBTITLE_CACHE_KEY, JSON.stringify(next));
  } catch {
    try {
      window.localStorage.setItem(SUBTITLE_CACHE_KEY, JSON.stringify(next.slice(0, 4)));
    } catch {
      // Caption playback still works when storage is full or unavailable.
    }
  }
}

export async function fetchExternalEnglishSubtitle(
  request: ExternalSubtitleRequest,
  signal?: AbortSignal
): Promise<ExternalSubtitle | null> {
  const apiKey = getOpenSubtitlesApiKey();
  if (!apiKey || !request.imdbId) return null;

  const cacheKey = buildCacheKey(request);
  const cached = getCachedSubtitle(cacheKey);
  if (cached) return cached;

  const search = await requestOpenSubtitles("openSubtitlesSearch", {
    apiKey,
    imdbId: request.imdbId,
    seasonNumber: request.season,
    episodeNumber: request.episode
  }, signal);
  const parsed = JSON.parse(search.body);
  const best = chooseBestOpenSubtitlesFile(Array.isArray(parsed?.data) ? parsed.data : [], request.releaseName);
  if (!best) return null;

  const downloaded = await requestOpenSubtitles("openSubtitlesDownload", {
    apiKey,
    fileId: best.fileId
  }, signal);
  const subtitle: ExternalSubtitle = {
    vtt: srtToWebVtt(downloaded.body),
    fileName: downloaded.fileName || best.fileName,
    fromCache: false
  };
  cacheSubtitle(cacheKey, subtitle);
  return subtitle;
}

export async function testOpenSubtitlesApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  if (!isValidOpenSubtitlesApiKey(apiKey)) throw new Error("Enter a valid OpenSubtitles API key.");
  await requestOpenSubtitles("openSubtitlesSearch", {
    apiKey: apiKey.trim(),
    imdbId: "tt0133093"
  }, signal);
}
