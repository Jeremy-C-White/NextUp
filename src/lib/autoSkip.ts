import type { IntroDBSegmentType } from "./introdb";

const AUTO_SKIP_ENABLED_KEY = "NEXTUP_AUTO_SKIP_INTROS_RECAPS";
export const AUTO_SKIP_DELAY_SECONDS = 10;
export const AUTO_SKIP_MINIMUM_REMAINDER_SECONDS = 2;

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function getBrowserStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function readAutoSkipEnabled(storage: StorageReader | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AUTO_SKIP_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveAutoSkipEnabled(
  enabled: boolean,
  storage: StorageWriter | null = getBrowserStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(AUTO_SKIP_ENABLED_KEY, String(enabled));
  } catch {
    // The setting remains active for this session when storage is unavailable.
  }
}

export function shouldAutomaticallySkipSegment(
  enabled: boolean,
  isPlaying: boolean,
  segmentType: IntroDBSegmentType | null | undefined,
  currentTimeSeconds: number,
  segmentStartSeconds: number,
  segmentEndSeconds: number
): boolean {
  if (!enabled || !isPlaying || (segmentType !== "intro" && segmentType !== "recap")) return false;
  if (![currentTimeSeconds, segmentStartSeconds, segmentEndSeconds].every(Number.isFinite)) return false;

  const triggerSeconds = segmentStartSeconds + AUTO_SKIP_DELAY_SECONDS;
  return segmentEndSeconds - triggerSeconds >= AUTO_SKIP_MINIMUM_REMAINDER_SECONDS
    && currentTimeSeconds >= triggerSeconds
    && currentTimeSeconds < segmentEndSeconds;
}

