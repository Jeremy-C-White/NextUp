import { UserEpisode } from "../types";
import { getReleasedEpisodes } from "./episodes";

export interface EpisodeProgressSelection {
  watchedIds: string[];
  unwatchedIds: string[];
}

export function buildEpisodeProgressSelection(
  episodes: UserEpisode[],
  lastWatchedEpisodeId: string | null
): EpisodeProgressSelection | null {
  const released = [...getReleasedEpisodes(episodes, false)].sort((first, second) => {
    if (first.season !== second.season) return first.season - second.season;
    return first.number - second.number;
  });
  const targetIndex = lastWatchedEpisodeId === null
    ? -1
    : released.findIndex(episode => episode.id === lastWatchedEpisodeId);

  if (lastWatchedEpisodeId !== null && targetIndex < 0) return null;
  return {
    watchedIds: released.slice(0, targetIndex + 1).map(episode => episode.id),
    unwatchedIds: released.slice(targetIndex + 1).map(episode => episode.id)
  };
}
