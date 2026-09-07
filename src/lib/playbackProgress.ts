export interface PlaybackProgressRecord {
  position: number;
  duration: number;
  updatedAt: number;
}

export interface PlaybackProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface EnumerablePlaybackProgressStorage extends PlaybackProgressStorage {
  readonly length: number;
  key(index: number): string | null;
}

const STORAGE_PREFIX = "nextup_playback_progress_v1";
const MAX_PROGRESS_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MIN_RESUME_POSITION_SECONDS = 30;
const MIN_REMAINING_SECONDS = 120;

export function formatPlaybackPosition(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getPlaybackProgressKey(userId: string, showId: string, episodeId: string): string {
  return [STORAGE_PREFIX, userId, showId, episodeId]
    .map(part => encodeURIComponent(part))
    .join(":");
}

function isValidProgressRecord(value: unknown, now: number): value is PlaybackProgressRecord {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PlaybackProgressRecord>;
  return Number.isFinite(candidate.position)
    && Number.isFinite(candidate.duration)
    && Number.isFinite(candidate.updatedAt)
    && (candidate.position || 0) >= 0
    && (candidate.duration || 0) > 0
    && (candidate.position || 0) < (candidate.duration || 0)
    && (candidate.updatedAt || 0) >= now - MAX_PROGRESS_AGE_MS
    && (candidate.updatedAt || 0) <= now + MAX_FUTURE_CLOCK_SKEW_MS;
}

export function readPlaybackProgress(
  storage: PlaybackProgressStorage,
  userId: string,
  showId: string,
  episodeId: string,
  now = Date.now()
): PlaybackProgressRecord | null {
  const key = getPlaybackProgressKey(userId, showId, episodeId);

  try {
    const serialized = storage.getItem(key);
    if (!serialized) return null;

    const parsed: unknown = JSON.parse(serialized);
    if (isValidProgressRecord(parsed, now)) return parsed;

    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be disabled or full. Playback should still continue normally.
    }
  }

  return null;
}

export function writePlaybackProgress(
  storage: PlaybackProgressStorage,
  userId: string,
  showId: string,
  episodeId: string,
  position: number,
  duration: number,
  now = Date.now()
): boolean {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0 || position >= duration) {
    return false;
  }

  const record: PlaybackProgressRecord = {
    position: Math.floor(position),
    duration: Math.floor(duration),
    updatedAt: now
  };

  try {
    storage.setItem(getPlaybackProgressKey(userId, showId, episodeId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearPlaybackProgress(
  storage: PlaybackProgressStorage,
  userId: string,
  showId: string,
  episodeId: string
): void {
  try {
    storage.removeItem(getPlaybackProgressKey(userId, showId, episodeId));
  } catch {
    // Storage failures should never prevent the player from closing or advancing.
  }
}

export function getResumePosition(
  record: PlaybackProgressRecord | null,
  playbackDuration = record?.duration || 0
): number | null {
  if (!record || !Number.isFinite(playbackDuration) || playbackDuration <= 0) return null;
  if (record.position < MIN_RESUME_POSITION_SECONDS) return null;
  if (playbackDuration - record.position < MIN_REMAINING_SECONDS) return null;
  return record.position;
}

/**
 * A replacement source in the same player session should continue from the
 * exact live position. The fresh-session resume guardrails intentionally do
 * not apply here: restarting because a source stalled is never desirable,
 * even inside the final two minutes of an episode.
 */
export function getSameSessionFailoverPosition(
  position: number,
  playbackDuration: number
): number | null {
  if (!Number.isFinite(position) || position <= 0) return null;
  if (!Number.isFinite(playbackDuration) || playbackDuration <= 1) return null;
  return Math.min(position, playbackDuration - 1);
}

export function getPlaybackPercentage(record: PlaybackProgressRecord | null): number | null {
  if (!record || !Number.isFinite(record.position) || !Number.isFinite(record.duration) || record.duration <= 0) return null;
  const percentage = Math.round((record.position / record.duration) * 100);
  return percentage > 0 && percentage < 100 ? percentage : null;
}

/**
 * Builds the Library's progress-ring lookup in one storage pass. This avoids
 * parsing localStorage once for every episode on every Library render.
 */
export function buildPlaybackPercentageIndex(
  storage: EnumerablePlaybackProgressStorage,
  userId: string,
  now = Date.now()
): Map<string, number> {
  const userPrefix = [STORAGE_PREFIX, userId]
    .map(part => encodeURIComponent(part))
    .join(":") + ":";
  const latestByShow = new Map<string, { percentage: number; updatedAt: number }>();

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(userPrefix)) continue;

      const encodedShowId = key.slice(userPrefix.length).split(":", 1)[0];
      if (!encodedShowId) continue;

      const serialized = storage.getItem(key);
      if (!serialized) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        continue;
      }
      if (!isValidProgressRecord(parsed, now)) continue;

      const percentage = getPlaybackPercentage(parsed);
      if (percentage === null) continue;

      let showId: string;
      try {
        showId = decodeURIComponent(encodedShowId);
      } catch {
        continue;
      }

      const current = latestByShow.get(showId);
      if (!current || parsed.updatedAt > current.updatedAt) {
        latestByShow.set(showId, { percentage, updatedAt: parsed.updatedAt });
      }
    }
  } catch {
    // Storage enumeration can be disabled independently of ordinary playback.
  }

  return new Map(Array.from(latestByShow, ([showId, value]) => [showId, value.percentage]));
}
