export interface SubtitleTrackDescriptor {
  kind?: string;
  language?: string;
  label?: string;
}

function isEnglish(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLocaleLowerCase();
  return normalized === "en" || normalized.startsWith("en-") || normalized.startsWith("en_") || normalized.includes("english");
}

function isUsableSubtitleTrack(track: SubtitleTrackDescriptor): boolean {
  const kind = (track.kind || "subtitles").toLocaleLowerCase();
  return kind === "subtitles" || kind === "captions" || kind === "";
}

export function findPreferredSubtitleTrackIndex(tracks: SubtitleTrackDescriptor[]): number {
  let fallbackIndex = -1;
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index];
    if (!isUsableSubtitleTrack(track)) continue;
    if (fallbackIndex < 0) fallbackIndex = index;
    if (isEnglish(track.language) || isEnglish(track.label)) return index;
  }
  return fallbackIndex;
}

export function findEnglishSubtitleTrackIndex(tracks: SubtitleTrackDescriptor[]): number {
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index];
    if (!isUsableSubtitleTrack(track)) continue;
    if (isEnglish(track.language) || isEnglish(track.label)) return index;
  }
  return -1;
}

export function isMeaningfulBackwardSeek(previousSeconds: number, targetSeconds: number, thresholdSeconds = 4): boolean {
  return Number.isFinite(previousSeconds)
    && Number.isFinite(targetSeconds)
    && previousSeconds - targetSeconds >= thresholdSeconds;
}
