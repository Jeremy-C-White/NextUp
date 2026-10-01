export const SILENT_STARTUP_TIMEOUT_MS = 7_000;
// The first request of a playback session often waits on AIOStreams/debrid
// link resolution before any media bytes (and therefore progress events) flow.
export const FIRST_ATTEMPT_SILENT_STARTUP_TIMEOUT_MS = 15_000;
export const PROGRESSING_STARTUP_TIMEOUT_MS = 20_000;
// Fresh budget for a source switch after playback already started (mid-episode
// failover or the "Next source" button), when the initial budget was cleared.
export const FAILOVER_STARTUP_BUDGET_MS = 30_000;
export const BUFFER_GROWTH_EPSILON_SECONDS = 0.05;
// HTMLMediaElement.HAVE_FUTURE_DATA, kept numeric so this module stays DOM-free.
const HAVE_FUTURE_DATA = 3;

interface BufferedRanges {
  readonly length: number;
  end(index: number): number;
}

export function getBufferedEndSeconds(buffered: BufferedRanges | null | undefined): number {
  if (!buffered || buffered.length < 1) return 0;
  let latestEnd = 0;
  for (let index = 0; index < buffered.length; index += 1) {
    try {
      const end = buffered.end(index);
      if (Number.isFinite(end)) latestEnd = Math.max(latestEnd, end);
    } catch {
      // A range can disappear while webOS updates the media buffer.
    }
  }
  return latestEnd;
}

export function hasMeaningfulStartupProgress(
  progressEventSeen: boolean,
  initialBufferedEnd: number,
  currentBufferedEnd: number
): boolean {
  return progressEventSeen
    || currentBufferedEnd > initialBufferedEnd + BUFFER_GROWTH_EPSILON_SECONDS;
}

export function getSilentStartupLimitMs(firstAttempt: boolean): number {
  return firstAttempt ? FIRST_ATTEMPT_SILENT_STARTUP_TIMEOUT_MS : SILENT_STARTUP_TIMEOUT_MS;
}

export function getStartupAttemptLimitMs(
  meaningfulProgress: boolean,
  availableBudgetMs: number,
  firstAttempt = false
): number {
  const desiredLimit = meaningfulProgress
    ? PROGRESSING_STARTUP_TIMEOUT_MS
    : getSilentStartupLimitMs(firstAttempt);
  return Math.max(0, Math.min(desiredLimit, availableBudgetMs));
}

/**
 * The startup deadline is cleared (0) once a source plays. A later switch to a
 * different stream must start a new budget, otherwise the probe would treat the
 * replacement as already started and never skip it if it stays silent.
 */
export function resolveStartupDeadline(
  currentDeadline: number,
  now: number,
  isNewStream: boolean
): number {
  if (currentDeadline > 0) return currentDeadline;
  return isNewStream ? now + FAILOVER_STARTUP_BUDGET_MS : 0;
}

export interface StartupMediaState {
  paused: boolean;
  readyState: number;
}

/** True when there is nothing left for the startup probe to decide. */
export function isStartupProbeSettled(
  startupDeadline: number,
  media?: StartupMediaState | null
): boolean {
  if (startupDeadline === 0) return true;
  return Boolean(media && !media.paused && media.readyState >= HAVE_FUTURE_DATA);
}

