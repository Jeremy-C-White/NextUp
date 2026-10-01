import { format } from "date-fns";
import { UserEpisode, UserShow } from "../types";
import { buildEpisodeBacklog, formatCatchUpDuration, hasRecentUnwatchedEpisode } from "./episodeBacklog";
import { getEpisodeReleaseTime, getTrackableEpisodes, isEpisodeReleased } from "./episodes";

/**
 * The Library is organised into shelves by what you can do next with each
 * title. Every title sits on exactly one shelf.
 */
export type LibraryShelfId = "continue" | "new" | "not-started" | "movies" | "waiting" | "finished";
export type LibraryFilter = "all" | LibraryShelfId;

export interface LibraryShelfInfo {
  id: LibraryShelfId;
  /** Row heading. */
  title: string;
  /** Short filter-button label. */
  label: string;
  /** Shown when this filter has nothing in it. */
  empty: string;
}
export const LIBRARY_SHELVES: readonly LibraryShelfInfo[] = [
  { id: "continue", title: "Continue watching", label: "Continue", empty: "Nothing in progress. Start something from Not started yet." },
  { id: "new", title: "New episodes", label: "New episodes", empty: "No new episodes from the last two weeks." },
  { id: "not-started", title: "Not started yet", label: "Not started", empty: "Everything you saved has been started." },
  { id: "movies", title: "Movies to watch", label: "Movies", empty: "No unwatched movies saved." },
  { id: "waiting", title: "Waiting for new episodes", label: "Waiting", empty: "No shows waiting on new episodes." },
  { id: "finished", title: "Finished", label: "Finished", empty: "Nothing finished yet." }
];

export const LIBRARY_FILTERS: readonly LibraryFilter[] = ["all", ...LIBRARY_SHELVES.map(shelf => shelf.id)];

/** Saved filters from before 1.0.87 map onto the new shelves. */
export function normalizeLibraryFilter(saved: string | null | undefined): LibraryFilter {
  if (saved && (LIBRARY_FILTERS as readonly string[]).includes(saved)) return saved as LibraryFilter;
  switch (saved) {
    case "watching":
    case "behind": return "continue";
    case "caught-up": return "waiting";
    case "ended": return "finished";
    default: return "all";
  }
}

export interface LibraryShelfPlacement {
  shelf: LibraryShelfId;
  /** Short status shown on the poster, e.g. "S2 E4 next" or "Returns Oct 12". */
  note: string;
  /** Optional second line under the title, e.g. "3h 20m left". */
  detail?: string;
}

export interface ClassifyOptions {
  now: Date;
  /** Saved position in a partly watched episode or movie, as a percentage. */
  partialPlayback?: number | null;
}

function shortDate(date: Date): string {
  return format(date, "MMM d");
}

function episodeCode(episode: UserEpisode): string {
  return `S${episode.season} E${episode.number}`;
}

function hasPartialPlayback(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 100;
}

function nextUpcomingEpisode(episodes: UserEpisode[], now: Date): UserEpisode | null {
  return getTrackableEpisodes(episodes, false)
    .map(episode => ({ episode, time: getEpisodeReleaseTime(episode) }))
    .filter((item): item is { episode: UserEpisode; time: Date } => Boolean(item.time && item.time > now))
    .sort((first, second) => first.time.getTime() - second.time.getTime())[0]?.episode || null;
}

function withDetail(placement: LibraryShelfPlacement, detail: string): LibraryShelfPlacement {
  return detail ? { ...placement, detail } : placement;
}

function classifyMovie(show: UserShow, episodes: UserEpisode[] | undefined, options: ClassifyOptions): LibraryShelfPlacement {
  const movie = episodes?.[0];
  const watched = movie ? movie.watched : Boolean(show.watchedEpisodes?.[`movie_${show.id}`]);
  if (watched) return { shelf: "finished", note: "Watched" };

  const runtime = Number(movie?.runtime || show.runtime) || 0;
  if (hasPartialPlayback(options.partialPlayback)) {
    const left = formatCatchUpDuration(runtime * (1 - (options.partialPlayback as number) / 100));
    return withDetail({ shelf: "continue", note: "Movie" }, left ? `${left} left` : "In progress");
  }
  if (movie && !isEpisodeReleased(movie, options.now)) {
    const releaseTime = getEpisodeReleaseTime(movie);
    return { shelf: "waiting", note: releaseTime ? `Out ${shortDate(releaseTime)}` : "Coming soon" };
  }
  return withDetail({ shelf: "movies", note: "Movie" }, formatCatchUpDuration(runtime));
}

/**
 * Which shelf a title belongs on, and the note for its poster.
 * `episodes` is undefined while the title's episodes are still loading.
 */
export function classifyLibraryShow(
  show: UserShow,
  episodes: UserEpisode[] | undefined,
  options: ClassifyOptions
): LibraryShelfPlacement {
  if (show.isMovie) return classifyMovie(show, episodes, options);

  const partial = hasPartialPlayback(options.partialPlayback);
  if (!episodes) {
    const watchedAny = Object.values(show.watchedEpisodes || {}).some(Boolean);
    return { shelf: watchedAny || partial ? "continue" : "not-started", note: "Loading progress" };
  }

  const backlog = buildEpisodeBacklog(episodes, show.runtime || 0, options.now);
  const releasedCount = backlog.releasedEpisodes.length;
  const watchedCount = releasedCount - backlog.unwatchedCount;
  const started = watchedCount > 0 || partial;

  if (backlog.unwatchedCount === 0) {
    const upcoming = nextUpcomingEpisode(episodes, options.now);
    if (upcoming) {
      const time = getEpisodeReleaseTime(upcoming)!;
      const note = upcoming.number === 1 && releasedCount > 0
        ? `S${upcoming.season} returns ${shortDate(time)}`
        : releasedCount === 0
          ? `Premieres ${shortDate(time)}`
          : `New episode ${shortDate(time)}`;
      return { shelf: "waiting", note };
    }
    if (releasedCount === 0) return { shelf: "waiting", note: "Coming soon" };
    if (show.status === "Ended") return { shelf: "finished", note: "Finished" };
    return { shelf: "waiting", note: "Caught up" };
  }

  const next = backlog.firstUnwatched!;
  const timeLeft = formatCatchUpDuration(backlog.remainingMinutes);

  const count = backlog.unwatchedCount === 1 ? "1 episode" : `${backlog.unwatchedCount} episodes`;
  if (!started) {
    return withDetail({ shelf: "not-started", note: count }, timeLeft ? `${timeLeft} in all` : "");
  }

  if (hasRecentUnwatchedEpisode(backlog, options.now.getTime())) {
    return backlog.unwatchedCount === 1
      ? { shelf: "new", note: `New · ${episodeCode(next)}` }
      : { shelf: "new", note: `${episodeCode(next)} next`, detail: `${count} to go` };
  }

  return withDetail({ shelf: "continue", note: `${episodeCode(next)} next` }, timeLeft ? `${timeLeft} left` : "");
}
