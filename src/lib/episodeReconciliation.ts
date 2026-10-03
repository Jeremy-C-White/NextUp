import { UserEpisode } from "../types";

/**
 * Metadata refreshes may finish after a user changes an episode. Preserve the
 * latest in-memory watch state while accepting all newly fetched metadata.
 */
export function preserveLatestEpisodeWatchState(
  refreshedEpisodes: UserEpisode[],
  currentEpisodes: UserEpisode[] | undefined
): UserEpisode[] {
  if (!currentEpisodes?.length) return refreshedEpisodes;

  const currentById = new Map(currentEpisodes.map(episode => [episode.id, episode]));
  return refreshedEpisodes.map(episode => {
    const current = currentById.get(episode.id);
    if (!current) return episode;
    return {
      ...episode,
      watched: current.watched,
      watchedAt: current.watchedAt
    };
  });
}
