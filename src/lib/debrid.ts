import { PlaybackCandidate } from "../types";
import { fetchThroughProxy, isWebOSTV } from "./webos";

export interface StreamOption {
  name?: string;
  title?: string;
  description?: string;

  url?: string;
  externalUrl?: string;
  ytId?: string;

  infoHash?: string;
  fileIdx?: number;
  sources?: string[];

  subtitles?: Array<{
    id?: string;
    url: string;
    lang?: string;
  }>;

  behaviorHints?: {
    videoSize?: number;
    filename?: string;
    notWebReady?: boolean;
    bingeGroup?: string;

    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
  streamData?: {
    id?: string;
    type?: string;
    filename?: string;
    folderName?: string;
    size?: number;
    folderSize?: number;
    addon?: string;
    indexer?: string;
    library?: boolean;
    proxied?: boolean;
    service?: {
      id?: string;
      cached?: boolean;
    };
    torrent?: {
      infoHash?: string;
      fileIdx?: number;
      seeders?: number;
      sources?: string[];
    };
    parsedFile?: {
      resolution?: string;
      quality?: string;
      encode?: string;
      container?: string;
      season?: number;
      episodes?: number[];
      audio?: string[];
      languages?: string[];
      language?: string;
    };
  };
}

type PlaybackType = string;

type ImportMetaWithEnv = ImportMeta & { env?: { VITE_AIOSTREAMS_BASE_URL?: string; }; };

const REQUEST_TIMEOUT_MS = 55_000;
const BYTES_PER_GB = 1024 ** 3;
const STREAM_LOOKUP_MAX_ATTEMPTS = 8;
const STREAM_DEFAULT_MAX_ATTEMPTS = 4;
const STREAM_EMPTY_MAX_ATTEMPTS = 5;
const STREAM_RETRY_DELAYS_MS = [750, 1_500, 3_000, 6_000, 10_000, 15_000, 20_000];

export function getAioStreamsBaseUrl(): string {
  const localUrl = typeof window !== "undefined" ? localStorage.getItem("aiostreams_base_url")?.trim() : null;
  const environmentUrl = (import.meta as ImportMetaWithEnv).env?.VITE_AIOSTREAMS_BASE_URL?.trim();
  const configuredUrl = localUrl || environmentUrl;
  if (!configuredUrl) {
    throw new Error("AIOStreams is not configured. Set VITE_AIOSTREAMS_BASE_URL or configure it in Settings.");
  }
  return normalizeAioStreamsBaseUrl(configuredUrl);
}

export function normalizeAioStreamsBaseUrl(configuredUrl: string): string {
  const normalizedUrl = configuredUrl.trim().replace(/\/manifest\.json(?:\?.*)?$/i, "").replace(/\/+$/, "");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("The configured AIOStreams URL is invalid.");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
    throw new Error("The configured AIOStreams URL must use HTTPS.");
  }
  return normalizedUrl;
}

let connectionWarmup: Promise<boolean> | null = null;

export function warmAioStreamsConnection(): Promise<boolean> {
  if (connectionWarmup) return connectionWarmup;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 15_000);
  const manifestUrl = `${getAioStreamsBaseUrl()}/manifest.json`;

  connectionWarmup = fetchThroughProxy(manifestUrl, controller.signal)
    .then(response => response.ok)
    .catch(() => false)
    .finally(() => {
      globalThis.clearTimeout(timeoutId);
      connectionWarmup = null;
    });

  return connectionWarmup;
}

function compactText(value?: string): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function getCombinedStreamText(stream: StreamOption): string {
  return [
    stream.streamData?.filename,
    stream.behaviorHints?.filename,
    stream.description,
    stream.title,
    stream.name
  ]
    .map(compactText)
    .filter(Boolean)
    .join(" ");
}

export type StreamAudioLanguage = "english" | "multi" | "non-english" | "unknown";

const ENGLISH_AUDIO_MARKER = /\b(?:english|eng)\b/i;
const MULTI_AUDIO_MARKER = /\b(?:multi(?:[ ._-]*(?:audio|lang(?:uage)?))?|dual[ ._-]*audio)\b/i;
const NON_ENGLISH_AUDIO_MARKER = /\b(?:spanish|espa(?:ñ|n)ol|french|fran(?:ç|c)ais|german|deutsch|italian|portuguese|russian|japanese|korean|chinese|mandarin|cantonese|hindi|tamil|telugu|arabic|turkish|polish|dutch|ukrainian|czech|thai|vietnamese|indonesian|latino)\b/i;

export function getStreamAudioLanguage(stream: StreamOption): StreamAudioLanguage {
  const parsedFile = stream.streamData?.parsedFile;
  const structured = [
    ...(Array.isArray(parsedFile?.languages) ? parsedFile.languages : []),
    ...(Array.isArray(parsedFile?.audio) ? parsedFile.audio : []),
    parsedFile?.language || ""
  ].map(value => String(value).trim().toLowerCase());

  if (structured.some(value => value === "en" || value === "eng" || value === "english" || value.startsWith("en-"))) {
    return "english";
  }

  const text = `${getCombinedStreamText(stream)} ${structured.join(" ")}`;
  const foreignAudioContext = new RegExp(
    `(?:${NON_ENGLISH_AUDIO_MARKER.source})[ ._\\-]*(?:audio|dub(?:bed)?)|(?:audio|lang(?:uage)?)[ :=._\\-]*(?:${NON_ENGLISH_AUDIO_MARKER.source})|(?:🌐|🔊)[ :._\\-]*(?:${NON_ENGLISH_AUDIO_MARKER.source})`,
    "i"
  );
  const foreignWithEnglishSubtitles = new RegExp(
    `(?:${NON_ENGLISH_AUDIO_MARKER.source}).{0,24}\\b(?:english|eng)[ ._\\-]*(?:sub(?:title)?s?|softsub)\\b`,
    "i"
  );
  const hasForeignMarker = foreignAudioContext.test(text) || foreignWithEnglishSubtitles.test(text);
  const englishSubtitleOnly = /\b(?:english|eng)[ ._-]*(?:sub(?:title)?s?|softsub)\b/i.test(text);
  const explicitEnglishAudio = /\b(?:english|eng)[ ._-]*(?:audio|dub(?:bed)?)\b/i.test(text);
  if (hasForeignMarker && englishSubtitleOnly && !explicitEnglishAudio && !MULTI_AUDIO_MARKER.test(text)) {
    return "non-english";
  }
  if (ENGLISH_AUDIO_MARKER.test(text)) return "english";
  if (MULTI_AUDIO_MARKER.test(text) || structured.some(value => value === "mul" || value.includes("multi") || value.includes("dual"))) {
    return "multi";
  }
  if (hasForeignMarker) return "non-english";

  const knownForeignTags = new Set(["es", "spa", "fr", "fra", "fre", "de", "deu", "ger", "it", "ita", "pt", "por", "ru", "rus", "ja", "jpn", "ko", "kor", "zh", "zho", "chi", "hi", "hin", "ta", "tam", "te", "tel", "ar", "ara", "tr", "tur", "pl", "pol", "nl", "nld", "uk", "ukr", "cs", "ces", "th", "tha", "vi", "vie", "id", "ind"]);
  if (structured.some(value => knownForeignTags.has(value))) return "non-english";
  return "unknown";
}

function getStreamSizeGB(stream: StreamOption): number | null {
  const byteSize = stream.streamData?.size ?? stream.behaviorHints?.videoSize;

  if (
    typeof byteSize === "number" &&
    Number.isFinite(byteSize) &&
    byteSize > 0
  ) {
    return byteSize / BYTES_PER_GB;
  }

  const text = getCombinedStreamText(stream);

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(TB|TiB|GB|GiB|MB|MiB)\b/i
  );

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (!Number.isFinite(amount)) {
    return null;
  }

  if (unit === "TB" || unit === "TIB") {
    return amount * 1024;
  }

  if (unit === "MB" || unit === "MIB") {
    return amount / 1024;
  }

  return amount;
}

function getStreamSizeBytes(stream: StreamOption): number | undefined {
  const providedSize = stream.streamData?.size ?? stream.behaviorHints?.videoSize;

  if (
    typeof providedSize === "number" &&
    Number.isFinite(providedSize) &&
    providedSize > 0
  ) {
    return providedSize;
  }

  const sizeGB = getStreamSizeGB(stream);

  if (sizeGB === null) {
    return undefined;
  }

  return Math.round(sizeGB * BYTES_PER_GB);
}

function getStreamSeeders(stream: StreamOption): number | undefined {
  if (typeof stream.streamData?.torrent?.seeders === "number") {
    return stream.streamData.torrent.seeders;
  }

  const text = getCombinedStreamText(stream);

  const patterns = [
    /(?:👤|👥)\s*(\d[\d,]*)/i,
    /(?:seeders|seeds|seed)\s*[:=]?\s*(\d[\d,]*)/i,
    /\bS\s*[:=]\s*(\d[\d,]*)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) {
      continue;
    }

    const parsed = Number.parseInt(
      match[1].replace(/,/g, ""),
      10
    );

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return undefined;
}

function getQualityLabel(stream: StreamOption): string {
  if (stream.streamData?.parsedFile?.resolution) {
    return stream.streamData.parsedFile.resolution;
  }

  const text = getCombinedStreamText(stream).toLowerCase();

  if (
    text.includes("2160p") ||
    text.includes("4k") ||
    text.includes("uhd")
  ) {
    return "2160p";
  }

  if (text.includes("1440p")) {
    return "1440p";
  }

  if (text.includes("1080p")) {
    return "1080p";
  }

  if (text.includes("720p")) {
    return "720p";
  }

  if (text.includes("480p")) {
    return "480p";
  }

  if (
    text.includes("360p") ||
    text.includes("sd")
  ) {
    return "SD";
  }

  const name = compactText(stream.name);

  return name || "Unknown";
}

function getDisplayTitle(
  stream: StreamOption,
  index: number
): string {
  const description = compactText(stream.description);
  const title = compactText(stream.title);
  const filename = compactText(
    stream.behaviorHints?.filename
  );
  const name = compactText(stream.name);

  return (
    description ||
    title ||
    filename ||
    name ||
    `Source ${index + 1}`
  );
}

function getDirectStreamUrl(
  stream: StreamOption
): string | null {
  const candidate = stream.url || stream.externalUrl;
  if (typeof candidate !== "string") {
    return null;
  }

  const value = candidate.trim();

  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export type BrowserCompatibility = 'compatible' | 'external' | 'unknown';

export interface StreamMediaProfile {
  container?: string;
  videoCodec?: string;
  audioCodecs: string[];
  text: string;
}

function canPlayMimeType(mimeType: string): boolean | null {
  if (typeof document === "undefined") return null;

  try {
    const result = document.createElement("video").canPlayType(mimeType);
    return result === "probably" || result === "maybe";
  } catch {
    return null;
  }
}

function isAppleMobileClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function getStreamMediaProfile(stream: StreamOption): StreamMediaProfile {
  const directUrl = getDirectStreamUrl(stream) || "";
  const parsedFile = stream.streamData?.parsedFile;
  const text = `${getCombinedStreamText(stream)} ${directUrl}`.toLowerCase();
  let container = parsedFile?.container?.toLowerCase().replace(/^\./, "");

  if (!container) {
    const containerMatch = text.match(/(?:^|[\s._-])(mkv|mp4|m4v|mov|webm|avi|wmv|asf|flv|m2ts|mts|ts|trp|tp|vob|mpg|mpeg)(?:$|[\s?&#._-])/i);
    container = containerMatch?.[1]?.toLowerCase();
  }

  const parsedVideoCodec = parsedFile?.encode?.toLowerCase();
  let videoCodec = parsedVideoCodec;
  if (!videoCodec) {
    if (/\b(?:hevc|h[ ._-]?265|x265)\b/i.test(text)) videoCodec = "hevc";
    else if (/\b(?:avc|h[ ._-]?264|x264)\b/i.test(text)) videoCodec = "h264";
    else if (/\bav1\b/i.test(text)) videoCodec = "av1";
    else if (/\bvp9\b/i.test(text)) videoCodec = "vp9";
    else if (/\bvp8\b/i.test(text)) videoCodec = "vp8";
    else if (/\b(?:mpeg[ ._-]?2|mpeg2)\b/i.test(text)) videoCodec = "mpeg2";
    else if (/\b(?:mpeg[ ._-]?4|mpeg4|xvid)\b/i.test(text)) videoCodec = "mpeg4";
  }

  const parsedAudio = Array.isArray(parsedFile?.audio)
    ? parsedFile.audio.map(value => value.toLowerCase())
    : [];
  const detectedAudio = [
    /\b(?:eac3|e-ac-3|ddp|dd\+)\b/i.test(text) ? "eac3" : "",
    /\b(?:ac3|ac-3|dolby[ ._-]*digital)\b/i.test(text) ? "ac3" : "",
    /\b(?:he[ ._-]*aac|heaac)\b/i.test(text) ? "he-aac" : "",
    /\baac\b/i.test(text) ? "aac" : "",
    /\bac[ ._-]?4\b/i.test(text) ? "ac4" : "",
    /\btruehd\b/i.test(text) ? "truehd" : "",
    /\bdts(?:[ ._-]*(?:hd|x))?\b/i.test(text) ? "dts" : "",
    /\bflac\b/i.test(text) ? "flac" : "",
    /\bopus\b/i.test(text) ? "opus" : "",
    /\bpcm\b/i.test(text) ? "pcm" : "",
    /\bmp3\b/i.test(text) ? "mp3" : "",
    /\bmp2\b/i.test(text) ? "mp2" : ""
  ].filter(Boolean);

  return {
    container,
    videoCodec,
    audioCodecs: Array.from(new Set([...parsedAudio, ...detectedAudio])),
    text
  };
}

/**
 * Compatibility profile for the 2025 LG QNED70/webOS 25 media pipeline.
 * Unknown direct streams remain eligible so the TV can probe their headers,
 * while explicitly incompatible codec combinations are filtered up front.
 */
export function getWebOSTVCompatibility(stream: StreamOption): BrowserCompatibility {
  if (!getDirectStreamUrl(stream)) return 'external';
  if (stream.behaviorHints?.proxyHeaders || stream.behaviorHints?.notWebReady === true) return 'external';

  const profile = getStreamMediaProfile(stream);
  const supportedContainers = new Set([
    "mp4", "m4v", "mov", "mkv", "ts", "m2ts", "mts", "trp", "tp",
    "avi", "wmv", "asf", "vob", "mpg", "mpeg", "webm"
  ]);
  if (profile.container && !supportedContainers.has(profile.container)) return 'external';

  if (/\b(?:vvc|h[ ._-]?266|x266)\b/i.test(profile.text)) return 'external';

  // QNED70 supports HDR10/HLG, not Dolby Vision. Dual HDR/DV releases retain
  // an HDR10 fallback and are safe; Dolby Vision-only releases are not.
  const dolbyVision = /\b(?:dolby[ ._-]*vision|dovi|dv)\b/i.test(profile.text);
  const hdrFallback = /\b(?:hdr10\+?|hdr|hlg|hybrid)\b/i.test(profile.text);
  if (dolbyVision && !hdrFallback) return 'external';

  const audioText = profile.audioCodecs.join(" ");
  const hasReliableAudio = /(?:^|\s)(?:eac3|ac3|he-aac|aac|ac4|pcm|mp3|mp2)(?:$|\s)/i.test(audioText);
  const hasUnsupportedOnlyAudio = /(?:truehd|dts|flac)/i.test(audioText) && !hasReliableAudio;
  if (hasUnsupportedOnlyAudio) return 'external';

  return 'compatible';
}

export function getWebOSTVPreferenceScore(stream: StreamOption): number {
  const profile = getStreamMediaProfile(stream);
  let score = 0;

  if (["mp4", "m4v", "mov"].includes(profile.container || "")) score += 800;
  else if (profile.container === "mkv") score += 650;
  else if (["ts", "m2ts", "mts", "trp", "tp"].includes(profile.container || "")) score += 450;

  if (/^(?:hevc|h265|x265)$/i.test(profile.videoCodec || "")) score += 900;
  else if (/^(?:h264|avc|x264)$/i.test(profile.videoCodec || "")) score += 800;
  else if (/^(?:av1|vp9)$/i.test(profile.videoCodec || "")) score += 300;

  const audioText = profile.audioCodecs.join(" ");
  if (/(?:^|\s)(?:eac3|ac3|he-aac|aac|ac4)(?:$|\s)/i.test(audioText)) score += 900;
  else if (/(?:^|\s)(?:pcm|mp3|mp2)(?:$|\s)/i.test(audioText)) score += 500;
  else if (/\bopus\b/i.test(audioText)) score += 150;

  if (/\b(?:truehd|dts|flac)\b/i.test(audioText)) score -= 1_200;

  if (/\bhdr10\+?\b/i.test(profile.text)) score += 250;
  return score;
}

export function getBrowserCompatibility(
  stream: StreamOption
): BrowserCompatibility {
  const directUrl = getDirectStreamUrl(stream);

  if (!directUrl) {
    return 'external';
  }

  if (isWebOSTV()) return getWebOSTVCompatibility(stream);

  if (stream.behaviorHints?.notWebReady === true) {
    return 'external';
  }

  /*
   * Streams requiring custom proxy headers usually cannot be mounted
   * directly into a normal browser video element.
   */
  if (stream.behaviorHints?.proxyHeaders) {
    return 'external';
  }

  const profile = getStreamMediaProfile(stream);
  const { container, text } = profile;
  const encode = profile.videoCodec;
  const audio = profile.audioCodecs;

  if (container) {
    if (['mkv', 'avi', 'wmv', 'flv', 'ts', 'm2ts', 'vob'].includes(container)) {
      return 'external';
    }
    
    if (['mp4', 'm4v', 'mov'].includes(container)) {
      const hasHevc = encode === 'hevc' || encode === 'h265' || /\bhevc\b|\bh265\b|\bx265\b/.test(text);
      const reliableAudio = audio.some(value => /^(?:aac|he-aac|ac3|eac3|mp3)$/i.test(value));
      const unsupportedAudio = audio.some(value => /^(?:dts|truehd|flac)$/i.test(value));

      // Many iPhones can decode HEVC in MP4 natively. Ask the actual browser
      // instead of rejecting every x265 release from its filename alone.
      if (hasHevc) {
        const supportsHevc = canPlayMimeType('video/mp4; codecs="hvc1"') === true ||
          canPlayMimeType('video/mp4; codecs="hev1"') === true;
        if (supportsHevc !== true) return 'external';
      }

      // Multi-audio files often include AAC alongside a cinema codec. Reject
      // only when the metadata says every known option is phone-incompatible.
      if (unsupportedAudio && !reliableAudio) return 'external';
      return 'compatible';
    }

    if (container === 'webm') {
      if (isAppleMobileClient()) return 'external';
      const supported = canPlayMimeType('video/webm');
      return supported === false ? 'external' : supported === true ? 'compatible' : 'unknown';
    }
  }

  if (/\bdts\b|\btruehd\b|\bflac\b/.test(text)) {
    return 'external';
  }

  // Debrid links are frequently opaque and omit the original extension.
  // Keep an unknown direct URL available for runtime probing by the phone's
  // native video element instead of prematurely sending it to an external app.
  return 'unknown';
}

function isStreamOption(value: unknown): value is StreamOption {
  return Boolean(value) && typeof value === "object";
}

function getDeduplicationKey(
  stream: StreamOption,
  index: number
): string {
  if (
    typeof stream.infoHash === "string" &&
    stream.infoHash.trim()
  ) {
    return [
      "torrent",
      stream.infoHash.trim().toLowerCase(),
      stream.fileIdx ?? ""
    ].join(":");
  }

  const filename = (stream.streamData?.filename || stream.behaviorHints?.filename || "").toLowerCase();
  const sizeBytes = getStreamSizeBytes(stream);

  if (filename && sizeBytes) {
    return `release:${filename}:${sizeBytes}`;
  }

  const directUrl = getDirectStreamUrl(stream);

  if (directUrl) {
    return `url:${directUrl}`;
  }

  return [
    "metadata",
    compactText(stream.name),
    compactText(stream.title),
    compactText(stream.description),
    index
  ].join(":");
}

function isMobileClient(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getPhonePlaybackPreferenceScore(stream: StreamOption): number {
  const profile = getStreamMediaProfile(stream);
  const container = profile.container || "";
  const codec = profile.videoCodec || "";
  const quality = getQualityLabel(stream).toLowerCase();
  const sizeGB = getStreamSizeGB(stream);
  let score = 0;

  if (["mp4", "m4v", "mov"].includes(container)) score += 300_000;
  else if (!container) score += 25_000;

  if (/^(?:h264|avc|x264)$/i.test(codec)) score += 80_000;
  else if (/^(?:hevc|h265|x265)$/i.test(codec) && getBrowserCompatibility(stream) === "compatible") score += 55_000;

  if (quality.includes("1080")) score += 30_000;
  else if (quality.includes("720")) score += 20_000;
  else if (quality.includes("2160") || quality.includes("4k") || quality.includes("uhd")) score -= 15_000;

  // Prefer streams that are practical on a cellular connection while keeping
  // larger releases available as fallbacks.
  if (sizeGB !== null) {
    if (sizeGB <= 3) score += 18_000;
    else if (sizeGB <= 8) score += 8_000;
    else if (sizeGB >= 20) score -= 20_000;
  }

  return score;
}

export function isHardRejectTrailer(stream: StreamOption, type: PlaybackType): boolean {
  const filename = (stream.behaviorHints?.filename || "").toLowerCase();
  const text = getCombinedStreamText(stream).toLowerCase();

  const isTiny = (() => {
    const sizeBytes = getStreamSizeBytes(stream);
    if (sizeBytes !== undefined && sizeBytes > 0) {
      const sizeMB = sizeBytes / (1024 * 1024);
      return (type === "movie" && sizeMB < 100) || (type === "series" && sizeMB < 30);
    }
    return false;
  })();

  const unmistakableRegex =
    /(?:^|[._\s-])(?:tlr(?:[._\s-]*\d+[a-z]?)?|official[._\s-]*trailers?|trailers?|teasers?|sample|featurette)(?=$|[._\s-]|\d)|(?:^|[^\p{L}\p{N}])\u0442\u0440\u0435\u0439\u043b\u0435\u0440(?:\u044b|\u0430|\u043e\u0432)?(?=$|[^\p{L}\p{N}])/iu;
  if (unmistakableRegex.test(filename) || unmistakableRegex.test(text)) {
    return true;
  }

  const strongRegex = /\b(trailer|official\s*trailer|teaser|sample|featurette|behind\s*the\s*scenes)\b/i;
  const hasStrongMarker = strongRegex.test(filename);
  
  if (hasStrongMarker && isTiny) return true;
  if (isTiny && strongRegex.test(text)) return true;
  
  return false;
}

export function getTrailerPenalty(stream: StreamOption, type: PlaybackType): number {
  let penalty = 0;
  const filename = (stream.behaviorHints?.filename || "").toLowerCase();
  const text = getCombinedStreamText(stream).toLowerCase();

  const isTiny = (() => {
    const sizeBytes = getStreamSizeBytes(stream);
    if (sizeBytes !== undefined && sizeBytes > 0) {
      const sizeMB = sizeBytes / (1024 * 1024);
      return (type === "movie" && sizeMB < 100) || (type === "series" && sizeMB < 30);
    }
    return false;
  })();

  if (isTiny) {
    penalty += 15_000;
  }

  const strongRegex = /\b(trailer|official\s*trailer|teaser|sample|featurette|behind\s*the\s*scenes)\b/i;
  const hasStrongMarker = strongRegex.test(filename) || strongRegex.test(text);

  if (hasStrongMarker) {
    penalty += 20_000;
  }

  const ambiguousRegex = /\b(preview|extra|extras|specials|promo|clip|bonus|making\s*of)\b/i;
  const hasAmbiguousMarker = ambiguousRegex.test(filename) || ambiguousRegex.test(text);

  if (hasAmbiguousMarker) {
    penalty += 10_000;
  }

  return penalty;
}

function isEpisodeMismatch(
  stream: StreamOption,
  expectedSeason: number,
  expectedEpisode: number
): boolean {
  if (stream.streamData?.parsedFile) {
    const { season, episodes } = stream.streamData.parsedFile;
    if (typeof season === "number" && Array.isArray(episodes) && episodes.length > 0) {
      if (season !== expectedSeason) return true;
      if (!episodes.includes(expectedEpisode)) return true;
      return false; // Authoritative match
    }
  }

  const text = getCombinedStreamText(stream);
  if (!text) return false;

  // 1. Single episode check like S02E01 when requesting S02E05
  const seMatches = Array.from(
    text.matchAll(/\b[sS](\d{1,2})[\s._-]*[eE](\d{1,3})\b/g)
  );

  if (seMatches.length > 0) {
    const hasExactMatch = seMatches.some((m) => {
      const s = parseInt(m[1], 10);
      const e = parseInt(m[2], 10);
      return s === expectedSeason && e === expectedEpisode;
    });

    if (hasExactMatch) {
      return false;
    }

    // Check if it's an episode range like S02E01-E10 or S02E01-08
    const rangeMatch = text.match(
      /\b[sS](\d{1,2})[\s._-]*[eE](\d{1,3})[\s._-]*(?:[eE]|-)(\d{1,3})\b/i
    );
    if (rangeMatch) {
      const s = parseInt(rangeMatch[1], 10);
      const eStart = parseInt(rangeMatch[2], 10);
      const eEnd = parseInt(rangeMatch[3], 10);
      if (
        s === expectedSeason &&
        expectedEpisode >= eStart &&
        expectedEpisode <= eEnd
      ) {
        return false;
      }
    }

    // Has SxxExx pattern but doesn't match expected episode -> mismatch
    return true;
  }

  // 2. Check "NxNN" format like 2x05 vs 2x01
  const xMatches = Array.from(text.matchAll(/\b(\d{1,2})[xX](\d{1,3})\b/g));
  if (xMatches.length > 0) {
    const hasExactMatch = xMatches.some((m) => {
      const s = parseInt(m[1], 10);
      const e = parseInt(m[2], 10);
      return s === expectedSeason && e === expectedEpisode;
    });
    if (hasExactMatch) return false;
    return true;
  }

  // 3. Season mismatch check like "Season 3" when Season 2 requested
  const seasonMatch = text.match(/\b(?:season|s)[\s._-]*(\d{1,2})\b/i);
  if (seasonMatch) {
    const s = parseInt(seasonMatch[1], 10);
    if (
      s !== expectedSeason &&
      !/\b(?:s\d+[-~]\s*s?\d+|complete|all\s*seasons|season\s*\d+[-~]\d+)\b/i.test(
        text
      )
    ) {
      return true;
    }
  }

  return false;
}

function isMovieMismatch(stream: StreamOption): boolean {
  const text = getCombinedStreamText(stream);
  if (!text) return false;

  // TV show patterns in a movie request indicate misindexed stream
  if (
    /\b[sS]\d{1,2}[\s._-]*[eE]\d{1,3}\b/i.test(text) ||
    /\b\d{1,2}[xX]\d{1,3}\b/i.test(text)
  ) {
    return true;
  }

  // Season packs and complete series patterns
  if (
    /\b[sS]\d{1,2}(-[sS]?\d{1,2})?\b/.test(text) ||
    /\b[sS]eason\s+\d{1,2}\b/i.test(text) ||
    /\b[sS]easons\s+\d{1,2}-\d{1,2}\b/i.test(text) ||
    /\b[cC]omplete\s+[sS]eason\b/i.test(text) ||
    /\b[cC]omplete\s+[sS]eries\b/i.test(text) ||
    /\b[aA]ll\s+[sS]easons\b/i.test(text)
  ) {
    return true;
  }

  return false;
}

export type StreamCacheState = 'cached' | 'uncached' | 'unknown';

export function getStreamCacheState(stream: StreamOption): StreamCacheState {
  if (stream.streamData?.service?.cached !== undefined) {
    return stream.streamData.service.cached ? 'cached' : 'uncached';
  }
  const text = getCombinedStreamText(stream).toLowerCase();
  
  // Real-Debrid explicit uncached tokens
  if (text.includes('[rd download]') || /\buncached\b/.test(text)) {
    return 'uncached';
  }
  
  // Real-Debrid explicit cache tokens
  if (text.includes('[rd+]') || text.includes('⚡') || /\bcached\b/.test(text)) {
    return 'cached';
  }
  
  return 'unknown';
}

export function calculateStreamScore(
  stream: StreamOption,
  originalIndex: number,
  totalCandidates: number,
  mobile: boolean,
  type: PlaybackType = "series",
  season: number = 1,
  episode: number = 1
): number {
  const browserCompatibility = getBrowserCompatibility(stream);
  const cacheState = getStreamCacheState(stream);

  /*
   * Preserve AIOStreams' original ordering as the starting point.
   */
  let score = (totalCandidates - originalIndex) * 10;

  if (browserCompatibility === 'compatible') {
    score += 10_000;
  } else if (browserCompatibility === 'external') {
    score += 1_000;
  }

  if (cacheState === 'cached') {
    score += 50_000;
  } else if (cacheState === 'uncached') {
    score -= 500_000; // Heavily penalize uncached so they fall to the very bottom
  }

  if (mobile) {
    score += getPhonePlaybackPreferenceScore(stream);
  }

  const audioLanguage = getStreamAudioLanguage(stream);
  if (audioLanguage === "english") {
    score += 250_000;
  } else if (audioLanguage === "multi") {
    score += 100_000;
  } else if (audioLanguage === "non-english") {
    score -= 750_000;
  }

  // Large-screen clients should try the best confirmed quality first. Keep
  // cached state and native compatibility as stronger signals than resolution.
  if (!mobile) {
    const quality = getQualityLabel(stream).toLowerCase();
    if (quality.includes("2160") || quality.includes("4k") || quality.includes("uhd")) {
      score += 4_000;
    } else if (quality.includes("1440")) {
      score += 2_500;
    } else if (quality.includes("1080")) {
      score += 1_500;
    } else if (quality.includes("720")) {
      score += 500;
    }

    if (isWebOSTV() && /\b(?:hdr10\+?|hlg)\b/i.test(getCombinedStreamText(stream))) {
      score += 500;
    }

    if (isWebOSTV()) {
      score += getWebOSTVPreferenceScore(stream);
    }
  }

  // Exact episode / season match bonus
  if (type === "series") {
    if (isEpisodeMismatch(stream, season, episode)) {
      score -= 30_000;
    }
  } else if (type === "movie") {
    if (isMovieMismatch(stream)) {
      score -= 30_000;
    }
  }

  score -= getTrailerPenalty(stream, type);

  return score;
}

export interface ParsedStreamInfo {
  filename: string;
  size?: string;
  readiness: string;
  quality?: string;
  seeds?: number;
  provider?: string;
}

export function parseStreamInfo(stream: StreamOption): ParsedStreamInfo {
  const text = getCombinedStreamText(stream);
  const title = stream.title || stream.description || "";
  const name = stream.name || "";
  
  const lines = title.split('\n');
  const filename = lines[0] || "Unknown Stream";
  
  let sizeStr: string | undefined;
  const sizeMatch = text.match(/(?:💾|size[:=]?)\s*([\d.]+\s*[KMGTP]B)/i);
  if (sizeMatch) {
    sizeStr = sizeMatch[1];
  } else if (stream.behaviorHints?.videoSize) {
    sizeStr = (stream.behaviorHints.videoSize / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  let quality: string | undefined;
  if (/\b(?:2160p|4k|uhd)\b/i.test(text)) quality = "4K";
  else if (/\b1440p\b/i.test(text)) quality = "1440p";
  else if (/\b1080p\b/i.test(text)) quality = "1080p";
  else if (/\b720p\b/i.test(text)) quality = "720p";
  else if (/\b480p\b/i.test(text)) quality = "480p";

  let provider: string | undefined;
  const providerMatch = text.match(/(?:⚙️|provider[:=]?)\s*([\w]+)/i);
  if (providerMatch) {
    provider = providerMatch[1];
  } else {
    provider = name.split('\n')[0];
  }

  return {
    filename,
    size: sizeStr,
    readiness: getStreamCacheState(stream),
    quality,
    seeds: getStreamSeeders(stream),
    provider
  };
}

async function readErrorResponse(
  response: Response
): Promise<string> {
  try {
    const text = await response.text();

    if (!text) {
      return "";
    }

    try {
      const parsed = JSON.parse(text) as {
        error?: unknown;
        message?: unknown;
      };

      if (typeof parsed.message === "string") {
        return parsed.message;
      }

      if (typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // The response was plain text rather than JSON.
    }

    return compactText(text).slice(0, 300);
  } catch {
    return "";
  }
}

export interface StreamLookupRetry {
  attempt: number;
  maxAttempts: number;
  status?: number;
  message: string;
}

type StreamLookupProgress = (progress: StreamLookupRetry) => void;

function waitForStreamRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function streamResponseError(status: number, detail: string): Error {
  if (status === 404) {
    return new Error("The private AIOStreams route stayed unavailable after automatic recovery attempts. Wait a moment and try again. If this continues, the saved AIOStreams installation URL may need to be regenerated.");
  }
  if (status === 504) {
    return new Error("Stream resolution timed out. Please check your network connection or configured AIOStreams/Stremio URL in Settings.");
  }
  if (status === 502) {
    return new Error("Unable to reach stream provider directly. Please check your configured URL in Settings.");
  }

  return new Error(`AIOStreams returned error ${status}.${detail ? ` ${detail}` : ""}`);
}

function isRetryableStreamStatus(status: number): boolean {
  return status === 404 || status === 408 || status === 425 || status === 429 ||
    status === 500 || status === 502 || status === 503;
}

function streamRetryLimit(status?: number, reason?: "network" | "empty" | "invalid"): number {
  if (status === 404) return STREAM_LOOKUP_MAX_ATTEMPTS;
  if (status === 429 || reason === "empty") return STREAM_EMPTY_MAX_ATTEMPTS;
  return STREAM_DEFAULT_MAX_ATTEMPTS;
}

function streamRetryDelay(attempt: number): number {
  return STREAM_RETRY_DELAYS_MS[Math.min(attempt - 1, STREAM_RETRY_DELAYS_MS.length - 1)];
}

function retryMessage(status?: number, reason?: "network" | "empty" | "invalid"): string {
  if (status === 404) return "Source service is warming up";
  if (status === 429) return "Source service is busy";
  if (reason === "empty") return "Sources are still being prepared";
  if (reason === "invalid") return "Source service returned an incomplete response";
  if (reason === "network") return "Source connection was interrupted";
  return "Source service is temporarily unavailable";
}

async function fetchStreamOptionsWithRetry(
  requestUrl: string,
  signal: AbortSignal,
  onRetry?: StreamLookupProgress
): Promise<unknown[]> {
  let lastError = new Error("The source lookup failed.");

  for (let attempt = 1; attempt <= STREAM_LOOKUP_MAX_ATTEMPTS; attempt++) {
    let response: Response;

    try {
      response = await fetchThroughProxy(requestUrl, signal);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") throw error;

      lastError = new Error("Unable to reach stream provider proxy. Please check your configured URL in Settings.");
      const maxAttempts = streamRetryLimit(undefined, "network");
      if (attempt >= maxAttempts) throw lastError;

      onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        message: retryMessage(undefined, "network")
      });
      await waitForStreamRetry(streamRetryDelay(attempt), signal);
      continue;
    }

    if (!response.ok) {
      const detail = await readErrorResponse(response);
      lastError = streamResponseError(response.status, detail);
      const maxAttempts = streamRetryLimit(response.status);

      if (!isRetryableStreamStatus(response.status) || attempt >= maxAttempts) {
        throw lastError;
      }

      onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        status: response.status,
        message: retryMessage(response.status)
      });
      await waitForStreamRetry(streamRetryDelay(attempt), signal);
      continue;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      lastError = new Error("AIOStreams returned a response that was not valid JSON.");
      const maxAttempts = streamRetryLimit(undefined, "invalid");
      if (attempt >= maxAttempts) throw lastError;

      onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        message: retryMessage(undefined, "invalid")
      });
      await waitForStreamRetry(streamRetryDelay(attempt), signal);
      continue;
    }

    if (!data || typeof data !== "object" || !Array.isArray((data as { streams?: unknown }).streams)) {
      lastError = new Error("AIOStreams returned an invalid stream response.");
      const maxAttempts = streamRetryLimit(undefined, "invalid");
      if (attempt >= maxAttempts) throw lastError;

      onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        message: retryMessage(undefined, "invalid")
      });
      await waitForStreamRetry(streamRetryDelay(attempt), signal);
      continue;
    }

    const streams = (data as { streams: unknown[] }).streams;
    if (streams.some(isStreamOption)) return streams;

    lastError = new Error("No sources were returned. Check the IMDb mapping and your enabled AIOStreams addons.");
    const maxAttempts = streamRetryLimit(undefined, "empty");
    if (attempt >= maxAttempts) throw lastError;

    onRetry?.({
      attempt: attempt + 1,
      maxAttempts,
      message: retryMessage(undefined, "empty")
    });
    await waitForStreamRetry(streamRetryDelay(attempt), signal);
  }

  throw lastError;
}

interface StreamCacheEntry {
  resolvedAt: number | null;
  promise: Promise<PlaybackCandidate[]>;
}
const STREAM_CACHE = new Map<string, StreamCacheEntry>();
const STREAM_CACHE_TTL_MS = 900_000;

export async function getBestAioStreamsSources(
  mediaId: string,
  season: number,
  episode: number,
  type: PlaybackType = "series",
  signal?: AbortSignal,
  forceRefresh: boolean = false,
  onRetry?: StreamLookupProgress,
  streamIdOverride?: string
): Promise<PlaybackCandidate[]> {
  const normalizedMediaId = mediaId.trim();
  const streamId = streamIdOverride?.trim() || (type === "series" ? `${normalizedMediaId}:${season}:${episode}` : normalizedMediaId);
  const cacheKey = `${type}:${streamId}`;
  
  const now = Date.now();
  if (forceRefresh) {
    STREAM_CACHE.delete(cacheKey);
  }
  const existing = STREAM_CACHE.get(cacheKey);
  if (existing) {
    if (existing.resolvedAt === null || now - existing.resolvedAt < STREAM_CACHE_TTL_MS) {
      return existing.promise;
    } else {
      STREAM_CACHE.delete(cacheKey);
    }
  }

  const promise = fetchBestStreamImpl(mediaId, season, episode, type, signal, onRetry, streamIdOverride);
  const entry: StreamCacheEntry = { resolvedAt: null, promise };
  STREAM_CACHE.set(cacheKey, entry);

  try {
    const result = await promise;
    // Only set resolvedAt if this is still the active entry
    if (STREAM_CACHE.get(cacheKey) === entry) {
      entry.resolvedAt = Date.now();
    }
    return result;
  } catch (error) {
    if (STREAM_CACHE.get(cacheKey) === entry) {
      STREAM_CACHE.delete(cacheKey);
    }
    throw error;
  }
}

// Backward-compatible name for older callers. Source discovery has always used
// the configured AIOStreams installation URL rather than calling Torrentio directly.
export const getBestTorrentioStream = getBestAioStreamsSources;

async function fetchBestStreamImpl(
  mediaId: string,
  season: number,
  episode: number,
  type: PlaybackType = "series",
  signal?: AbortSignal,
  onRetry?: StreamLookupProgress,
  streamIdOverride?: string
): Promise<PlaybackCandidate[]> {
  const normalizedMediaId = mediaId.trim();
  const directStreamId = streamIdOverride?.trim();

  if (
    !directStreamId &&
    type === "series" &&
    (
      !Number.isInteger(season) ||
      !Number.isInteger(episode) ||
      season < 1 ||
      episode < 1
    )
  ) {
    throw new Error("INVALID_EPISODE_MAPPING");
  }

  if (!directStreamId && !/^tt\d+$/.test(normalizedMediaId)) {
    throw new Error(
      type === "movie"
        ? "This movie does not have a valid IMDb identifier."
        : "This series does not have a valid IMDb identifier."
    );
  }

  const streamId =
    directStreamId || (type === "series"
      ? `${normalizedMediaId}:${season}:${episode}`
      : normalizedMediaId);

  const baseUrl = getAioStreamsBaseUrl();
  const encodedStreamId = encodeURIComponent(streamId).replace(/%3A/gi, ":");
  const requestUrl = `${baseUrl}/stream/${encodeURIComponent(type)}/${encodedStreamId}.json`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    145_000
  );
  
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  let rawStreams: unknown[];

  try {
    rawStreams = await fetchStreamOptionsWithRetry(requestUrl, controller.signal, onRetry);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Stream resolution timed out. Please check your network connection or configured AIOStreams/Stremio URL in Settings."
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "Unable to reach stream provider proxy. Please check your configured URL in Settings."
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const streams = rawStreams.filter(isStreamOption);

  if (streams.length === 0) {
    throw new Error(
      `No sources were returned for this ${type}. Check the IMDb mapping and your enabled AIOStreams addons.`
    );
  }

  const seenStreamCounts = new Map<string, number>();
  let uniqueStreams = streams.filter((stream, index) => {
    const key = getDeduplicationKey(stream, index);
    const count = seenStreamCounts.get(key) || 0;
    
    // Retain up to 3 copies of the same release/hash for failover
    if (count >= 3) {
      return false;
    }
    
    seenStreamCounts.set(key, count + 1);
    return true;
  });

  // The in-app TV player needs a resolved HTTP(S) media URL. Never convert an
  // infoHash-only result into a PlaybackCandidate with an undefined URL.
  const directStreams = uniqueStreams.filter(
    (stream) => getDirectStreamUrl(stream) !== null
  );

  if (directStreams.length === 0) {
    const torrentOnlyCount = uniqueStreams.filter(
      (stream) =>
        typeof stream.infoHash === "string" &&
        stream.infoHash.trim().length > 0
    ).length;

    if (torrentOnlyCount > 0) {
      throw new Error(
        `AIOStreams found ${torrentOnlyCount} torrent source${
          torrentOnlyCount === 1 ? "" : "s"
        }, but none were resolved to a direct playback URL. Check that your debrid provider is connected and that resolved or cached links are enabled.`
      );
    }

    throw new Error(
      "Sources were returned, but none contained a valid HTTP or HTTPS playback URL."
    );
  }

  // Filter out trailers, samples, wrong episode/season, and wrong media type
  const streamsToProcess = directStreams.filter((stream) => {
    if (isHardRejectTrailer(stream, type)) {
      return false;
    }
    if (type === "series" && isEpisodeMismatch(stream, season, episode)) {
      return false;
    }
    if (type === "movie" && isMovieMismatch(stream)) {
      return false;
    }
    return true;
  });

  if (streamsToProcess.length === 0) {
    throw new Error(
      "Sources were returned, but all of them were identified as mismatched (wrong episode, sample, trailer, etc.)."
    );
  }

  // Never intentionally start a release explicitly labelled as foreign-only.
  // Unlabelled releases remain available because many English releases omit a
  // language tag; the player performs a second check against embedded tracks.
  const languageEligibleStreams = streamsToProcess.filter(
    stream => getStreamAudioLanguage(stream) !== "non-english"
  );

  if (languageEligibleStreams.length === 0) {
    throw new Error("No source with English or selectable multilingual audio was found.");
  }

  const mobile = isMobileClient();

  interface PlaybackCandidateInternal extends PlaybackCandidate {
  cacheState: StreamCacheState;
}

  const playbackCandidates: PlaybackCandidateInternal[] =
    languageEligibleStreams.map((stream, index) => {
      const directUrl = getDirectStreamUrl(stream);

      /*
       * directStreams was filtered above, so this should never occur.
       * Keep the guard to prevent undefined URLs from entering the UI.
       */
      if (!directUrl) {
        throw new Error(
          "A source disappeared while preparing playback."
        );
      }

      const browserCompatibility = getBrowserCompatibility(stream);

      const seeders =
        getStreamSeeders(stream);

      const quality =
        getQualityLabel(stream);

      const parsedInfo = parseStreamInfo(stream);
      const audioLanguage = getStreamAudioLanguage(stream);
      const mediaProfile = getStreamMediaProfile(stream);

      return {
        id: stream.infoHash?.trim()
          ? `${stream.infoHash.trim().toLowerCase()}:${stream.fileIdx ?? "unknown"}:${directUrl}`
          : directUrl || `candidate-${index}`,

        url: directUrl,

        /*
         * Always provide visible text so the UI never renders an
         * empty source card.
         */
        title: parsedInfo.filename,

        quality: parsedInfo.quality || quality,

        sizeBytes: getStreamSizeBytes(stream),

        container: browserCompatibility === "compatible"
          ? "web-compatible"
          : browserCompatibility === "unknown"
            ? "web-probe"
            : "external",

        playbackSupport: browserCompatibility === "compatible"
          ? "native"
          : browserCompatibility === "unknown"
            ? "probe"
            : "external",

        mediaContainer: mediaProfile.container,
        videoCodec: mediaProfile.videoCodec,
        audioCodec: mediaProfile.audioCodecs.join(" / ") || undefined,

        score: calculateStreamScore(
          stream,
          index,
          languageEligibleStreams.length,
          mobile,
          type,
          season,
          episode
        ),
        cacheState: getStreamCacheState(stream),

        seeders,
        readiness: parsedInfo.readiness,
        provider: parsedInfo.provider,
        audioLanguage: audioLanguage === "non-english" ? "unknown" : audioLanguage
      };
    });

  playbackCandidates.sort((first, second) => {
    const supportTier = { native: 3, probe: 2, external: 1 };
    const firstSupport = supportTier[first.playbackSupport || "external"];
    const secondSupport = supportTier[second.playbackSupport || "external"];
    if (firstSupport !== secondSupport) return secondSupport - firstSupport;

    const languageTier = { english: 3, multi: 2, unknown: 1 };
    const firstLanguageTier = languageTier[first.audioLanguage || "unknown"];
    const secondLanguageTier = languageTier[second.audioLanguage || "unknown"];
    if (firstLanguageTier !== secondLanguageTier) return secondLanguageTier - firstLanguageTier;

    const tier = { cached: 2, unknown: 1, uncached: 0 };
    const firstTier = tier[first.cacheState];
    const secondTier = tier[second.cacheState];
    if (firstTier !== secondTier) return secondTier - firstTier;
    return second.score - first.score;
  });

  let finalCandidates = playbackCandidates;
  const hasConfirmedCached = finalCandidates.some(c => c.cacheState === "cached");
  
  if (hasConfirmedCached) {
    // If we have cached options, exclude uncached options
    finalCandidates = finalCandidates.filter(c => c.cacheState !== "uncached");
  }

  const compatible = finalCandidates.filter(c => c.container === "web-compatible");
  const probe = finalCandidates.filter(c => c.container === "web-probe");
  const external = finalCandidates.filter(c => c.container === "external");

  return [
    ...compatible,
    ...probe,
    ...external.slice(0, 15)
  ];
}
