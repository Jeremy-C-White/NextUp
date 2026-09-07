import { PlaybackCandidate } from "../types";

const candidateKey = (candidate: PlaybackCandidate): string => candidate.id || candidate.url;

const isResolutionFallback = (candidate: PlaybackCandidate): boolean =>
  /1080|720/i.test(candidate.quality || "") || /(?:^|[\s._-])(?:1080p|720p)(?:$|[\s._-])/i.test(candidate.title);

const isStablePhoneContainer = (candidate: PlaybackCandidate): boolean =>
  ["mp4", "m4v", "mov"].includes((candidate.mediaContainer || "").toLowerCase());

/**
 * Preserve source quality while ensuring a native MP4-family fallback and a
 * practical 1080p/720p fallback are reached inside the phone startup budget.
 * Opaque debrid URLs marked for probing remain eligible for the native player.
 */
export function selectPhonePlaybackCandidates(
  rankedCandidates: PlaybackCandidate[],
  maximum: number = 8
): PlaybackCandidate[] {
  const eligible = rankedCandidates.filter(candidate =>
    candidate.container === "web-compatible" || candidate.container === "web-probe"
  );
  if (eligible.length <= maximum) return eligible;

  const selected: PlaybackCandidate[] = [];
  const selectedKeys = new Set<string>();
  const add = (candidate?: PlaybackCandidate) => {
    if (!candidate || selected.length >= maximum) return;
    const key = candidateKey(candidate);
    if (selectedKeys.has(key)) return;
    selectedKeys.add(key);
    selected.push(candidate);
  };

  eligible.slice(0, 4).forEach(add);
  add(eligible.find(isStablePhoneContainer));
  add(eligible.find(isResolutionFallback));
  eligible.forEach(add);

  return selected;
}
