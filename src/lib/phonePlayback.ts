import { PlaybackCandidate } from "../types";

const isStablePhoneContainer = (candidate: PlaybackCandidate): boolean =>
  ["mp4", "m4v", "mov"].includes((candidate.mediaContainer || "").toLowerCase());

const getPhoneCandidateScore = (candidate: PlaybackCandidate): number => {
  const videoCodec = (candidate.videoCodec || "").toLowerCase();
  const audioCodec = (candidate.audioCodec || "").toLowerCase();
  const quality = `${candidate.quality || ""} ${candidate.title || ""}`.toLowerCase();
  let score = 0;

  // A confirmed native MP4 is substantially more reliable in mobile Safari
  // than an opaque URL that still needs a browser probe.
  if (candidate.container === "web-compatible") score += 5_000;
  else if (candidate.container === "web-probe") score += 1_000;

  if (isStablePhoneContainer(candidate)) score += 4_000;

  if (/^(?:h264|avc|x264)$/.test(videoCodec)) score += 1_200;
  else if (/^(?:hevc|h265|x265)$/.test(videoCodec)) score += 850;
  else if (!videoCodec) score += 100;

  if (/(?:^|\s|\/)(?:aac|he-aac|mp3|ac3|eac3)(?:$|\s|\/)/i.test(audioCodec)) score += 1_000;
  if (/\b(?:dts|truehd|flac|opus)\b/i.test(audioCodec)) score -= 1_500;

  if (candidate.audioLanguage === "english") score += 700;
  else if (candidate.audioLanguage === "multi") score += 450;

  if (candidate.readiness === "cached") score += 600;
  else if (candidate.readiness === "uncached") score -= 1_000;

  if (/\b1080p?\b/.test(quality)) score += 350;
  else if (/\b720p?\b/.test(quality)) score += 250;
  else if (/\b(?:2160p?|4k|uhd)\b/.test(quality)) score -= 200;

  if (candidate.sizeBytes) {
    const sizeGB = candidate.sizeBytes / 1024 / 1024 / 1024;
    if (sizeGB <= 3) score += 180;
    else if (sizeGB >= 20) score -= 300;
  }

  // Preserve the provider's quality/order judgement only as the final tie-break.
  score += Math.max(-500, Math.min(500, candidate.score / 1_000));
  return score;
};

const isMkvCandidate = (candidate: PlaybackCandidate): boolean => {
  if ((candidate.mediaContainer || "").toLowerCase() === "mkv") return true;
  if (/(?:^|[\s._-])mkv(?:$|[\s._-])/i.test(candidate.title || "")) return true;

  try {
    return /\.mkv$/i.test(new URL(candidate.url).pathname);
  } catch {
    return /\.mkv(?:$|[?#])/i.test(candidate.url || "");
  }
};

export type ExternalPlayerPlatform = "ios" | "android" | "desktop";

export function getExternalPlayerLaunchUrl(
  directStreamUrl: string,
  platform: ExternalPlayerPlatform
): string {
  if (platform === "ios") {
    return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(directStreamUrl)}`;
  }
  if (platform === "android") return `vlc://${directStreamUrl}`;
  return directStreamUrl;
}

/**
 * Keep VLC as a true last resort: only direct MKV options that the browser
 * classified as external are exposed after native phone playback is exhausted.
 */
export function selectVlcFallbackCandidates(
  rankedCandidates: PlaybackCandidate[],
  maximum: number = 12
): PlaybackCandidate[] {
  return rankedCandidates
    .filter(candidate =>
      (candidate.container === "external" || candidate.playbackSupport === "external") &&
      isMkvCandidate(candidate)
    )
    .slice(0, maximum);
}

/**
 * Preserve source quality while ensuring a native MP4-family fallback and a
 * practical 1080p/720p fallback are reached inside the phone startup budget.
 * Opaque debrid URLs marked for probing remain eligible for the native player.
 */
export function selectPhonePlaybackCandidates(
  rankedCandidates: PlaybackCandidate[],
  maximum: number = Number.POSITIVE_INFINITY
): PlaybackCandidate[] {
  const eligible = rankedCandidates.filter(candidate =>
    candidate.container === "web-compatible" || candidate.container === "web-probe"
  );

  return eligible
    .map((candidate, originalIndex) => ({ candidate, originalIndex, phoneScore: getPhoneCandidateScore(candidate) }))
    .sort((first, second) =>
      second.phoneScore - first.phoneScore ||
      second.candidate.score - first.candidate.score ||
      first.originalIndex - second.originalIndex
    )
    .slice(0, maximum)
    .map(item => item.candidate);
}
