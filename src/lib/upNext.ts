import { UserEpisode, UserShow } from "../types";
import { getEpisodeReleaseTime } from "./episodes";
import { format } from "date-fns";
import { buildEpisodeBacklog, EpisodeBacklog, hasRecentUnwatchedEpisode } from "./episodeBacklog";

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_RELEASE_WINDOW_MS = 14 * DAY_MS;
const RECENTLY_WATCHED_WINDOW_MS = 60 * DAY_MS;
const RECENTLY_ADDED_WINDOW_MS = 30 * DAY_MS;

export type UpNextReason = "New episode" | "Catch up" | "Continue watching" | "Recently added" | "Ready to watch";

export interface UpNextQueueItem {
  show: UserShow;
  nextEp: UserEpisode;
  progress: number;
  backlog?: EpisodeBacklog;
}

export interface SmartUpNextItem extends Omit<UpNextQueueItem, "backlog"> {
  queueReason: UpNextReason;
  backlog: EpisodeBacklog;
}

interface RankedUpNextItem extends SmartUpNextItem {
  priority: number;
  releaseTime: number;
  lastWatchedAt: number;
  addedAt: number;
  originalIndex: number;
}

function getLastWatchedAt(item: UpNextQueueItem): number {
  const episodeActivity = (item.show.episodes || []).reduce(
    (latest, episode) => Math.max(latest, episode.watchedAt || 0),
    0
  );
  const storedActivity = Object.values(item.show.watchedEpisodes || {}).reduce<number>(
    (latest, watchedAt) => Math.max(latest, typeof watchedAt === "number" ? watchedAt : 0),
    0
  );
  return Math.max(episodeActivity, storedActivity);
}

function isWithinWindow(timestamp: number, now: number, windowMs: number): boolean {
  return timestamp > 0 && timestamp <= now && now - timestamp <= windowMs;
}

function isSameLocalDate(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

export function formatUpNextAirDate(releaseTime: Date, now: Date = new Date()): string {
  if (isSameLocalDate(releaseTime, now)) return "Aired today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDate(releaseTime, yesterday)) return "Aired yesterday";

  const datePattern = releaseTime.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy";
  return `Aired ${format(releaseTime, datePattern)}`;
}

export function rankUpNextItems(items: UpNextQueueItem[], now: number = Date.now()): SmartUpNextItem[] {
  return items
    .map((item, originalIndex): RankedUpNextItem => {
      const fallbackEpisodes = item.show.episodes?.some(episode => episode.id === item.nextEp.id)
        ? item.show.episodes
        : [...(item.show.episodes || []), item.nextEp];
      const backlog = item.backlog || buildEpisodeBacklog(fallbackEpisodes, item.show.runtime || 0, new Date(now));
      const releaseTime = backlog.latestUnwatchedAt?.getTime() || getEpisodeReleaseTime(item.nextEp)?.getTime() || 0;
      const lastWatchedAt = Math.max(
        getLastWatchedAt(item),
        item.nextEp.watchedAt || 0
      );
      const addedAt = item.show.addedAt || 0;

      if (hasRecentUnwatchedEpisode(backlog, now, NEW_RELEASE_WINDOW_MS)) {
        return { ...item, backlog, queueReason: backlog.unwatchedCount > 1 ? "Catch up" : "New episode", priority: 3, releaseTime, lastWatchedAt, addedAt, originalIndex };
      }
      if (isWithinWindow(lastWatchedAt, now, RECENTLY_WATCHED_WINDOW_MS)) {
        return { ...item, backlog, queueReason: backlog.unwatchedCount > 1 ? "Catch up" : "Continue watching", priority: 2, releaseTime, lastWatchedAt, addedAt, originalIndex };
      }
      if (isWithinWindow(addedAt, now, RECENTLY_ADDED_WINDOW_MS)) {
        return { ...item, backlog, queueReason: backlog.unwatchedCount > 1 ? "Catch up" : "Recently added", priority: 1, releaseTime, lastWatchedAt, addedAt, originalIndex };
      }
      return { ...item, backlog, queueReason: backlog.unwatchedCount > 1 ? "Catch up" : "Ready to watch", priority: 0, releaseTime, lastWatchedAt, addedAt, originalIndex };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;

      if (a.priority === 3 && a.releaseTime !== b.releaseTime) return b.releaseTime - a.releaseTime;
      if (a.priority === 2 && a.lastWatchedAt !== b.lastWatchedAt) return b.lastWatchedAt - a.lastWatchedAt;
      if (a.priority === 1 && a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;

      const aFallbackActivity = Math.max(a.releaseTime, a.lastWatchedAt, a.addedAt);
      const bFallbackActivity = Math.max(b.releaseTime, b.lastWatchedAt, b.addedAt);
      if (aFallbackActivity !== bFallbackActivity) return bFallbackActivity - aFallbackActivity;

      const nameOrder = String(a.show.name || "").localeCompare(String(b.show.name || ""));
      return nameOrder || a.originalIndex - b.originalIndex;
    })
    .map(({ priority: _priority, releaseTime: _releaseTime, lastWatchedAt: _lastWatchedAt, addedAt: _addedAt, originalIndex: _originalIndex, ...item }) => item);
}
