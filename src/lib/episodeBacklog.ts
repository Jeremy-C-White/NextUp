import { UserEpisode } from "../types";
import { getEpisodeReleaseTime, getTrackableEpisodes, isEpisodeReleased } from "./episodes";

export const RECENT_EPISODE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface EpisodeBacklog {
  releasedEpisodes: UserEpisode[];
  unwatchedEpisodes: UserEpisode[];
  firstUnwatched: UserEpisode | null;
  latestUnwatched: UserEpisode | null;
  unwatchedCount: number;
  remainingMinutes: number;
  oldestUnwatchedAt: Date | null;
  latestUnwatchedAt: Date | null;
}

function compareEpisodeOrder(first: UserEpisode, second: UserEpisode): number {
  return first.season - second.season || first.number - second.number;
}

export function buildEpisodeBacklog(
  episodes: UserEpisode[],
  fallbackRuntimeMinutes = 0,
  now: Date = new Date()
): EpisodeBacklog {
  const releasedEpisodes = getTrackableEpisodes(episodes, false)
    .filter(episode => isEpisodeReleased(episode, now))
    .sort(compareEpisodeOrder);
  const unwatchedEpisodes = releasedEpisodes.filter(episode => !episode.watched);
  const firstUnwatched = unwatchedEpisodes[0] || null;
  const latestUnwatched = unwatchedEpisodes[unwatchedEpisodes.length - 1] || null;
  const safeFallbackRuntime = Number.isFinite(fallbackRuntimeMinutes) && fallbackRuntimeMinutes > 0
    ? fallbackRuntimeMinutes
    : 0;
  const remainingMinutes = unwatchedEpisodes.reduce((total, episode) => {
    const runtime = Number.isFinite(episode.runtime) && (episode.runtime || 0) > 0
      ? episode.runtime || 0
      : safeFallbackRuntime;
    return total + runtime;
  }, 0);

  return {
    releasedEpisodes,
    unwatchedEpisodes,
    firstUnwatched,
    latestUnwatched,
    unwatchedCount: unwatchedEpisodes.length,
    remainingMinutes,
    oldestUnwatchedAt: firstUnwatched ? getEpisodeReleaseTime(firstUnwatched) : null,
    latestUnwatchedAt: latestUnwatched ? getEpisodeReleaseTime(latestUnwatched) : null
  };
}

export function hasRecentUnwatchedEpisode(
  backlog: Pick<EpisodeBacklog, "latestUnwatchedAt">,
  now: number = Date.now(),
  windowMs: number = RECENT_EPISODE_WINDOW_MS
): boolean {
  const timestamp = backlog.latestUnwatchedAt?.getTime() || 0;
  return timestamp > 0 && timestamp <= now && now - timestamp <= windowMs;
}

export function formatCatchUpDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const roundedMinutes = Math.max(1, Math.round(minutes));
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}
