import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { UserEpisode, UserShow } from "../types";
import { buildEpisodeBacklog, RECENT_EPISODE_WINDOW_MS } from "./episodeBacklog";
import { getEpisodeReleaseTime, getTrackableEpisodes } from "./episodes";

/**
 * The Coming tab: what aired recently, a day-by-day schedule for the next
 * week, and later episodes grouped by month.
 */

export const SCHEDULE_DAYS = 7;

export interface ScheduleCard {
  key: string;
  show: UserShow;
  /** The show's episodes in this slot, in episode order. */
  episodes: UserEpisode[];
  /** When the first of them airs. */
  releaseTime: Date;
  /** False when only the date is known (no airing time). */
  hasTime: boolean;
  /** "Series premiere" / "Season 3 premiere", when the slot starts a season. */
  premiere: string | null;
}
export interface ScheduleGroup {
  key: string;
  title: string;
  cards: ScheduleCard[];
}

export interface RecentCard {
  key: string;
  show: UserShow;
  /** Unwatched episodes that aired in the last two weeks, in episode order. */
  episodes: UserEpisode[];
  latestRelease: Date;
  /** The episode Play starts: the next unwatched one, so nothing is skipped. */
  playEpisode: UserEpisode;
}

/** One column of the week guide; every one of the 7 days is present. */
export interface ScheduleDay {
  key: string;
  date: Date;
  /** "Today", "Tomorrow", or the weekday ("Tuesday"). */
  title: string;
  /** "Sep 29" */
  subtitle: string;
  isToday: boolean;
  cards: ScheduleCard[];
}

export interface ComingSchedule {
  recent: RecentCard[];
  /** Days that have something airing (for lists). */
  week: ScheduleGroup[];
  /** All 7 days, including empty ones (for the week guide). */
  weekDays: ScheduleDay[];
  later: ScheduleGroup[];
  /** Everything under Later, in date order. */
  laterCards: ScheduleCard[];
  summary: string;
  episodesThisWeek: number;
}

function compareEpisodeOrder(first: UserEpisode, second: UserEpisode) {
  return first.season - second.season || first.number - second.number;
}

export function premiereLabel(show: UserShow, episode: UserEpisode): string | null {
  if (show.isMovie || episode.number !== 1) return null;
  return episode.season <= 1 ? "Series premiere" : `Season ${episode.season} premiere`;
}

export function scheduleDayTitle(date: Date, now: Date): string {
  const days = differenceInCalendarDays(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

export function scheduleMonthTitle(date: Date, now: Date): string {
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return `Later in ${format(date, "MMMM")}`;
  }
  return date.getFullYear() === now.getFullYear() ? format(date, "MMMM") : format(date, "MMMM yyyy");
}

/** "S2 E4 · Title", or "3 new episodes · S2 E1-E3" for several on one day. */
export function describeEpisodes(show: UserShow, episodes: UserEpisode[]): string {
  if (show.isMovie) return "Movie";
  if (episodes.length === 1) {
    const [episode] = episodes;
    const code = `S${episode.season} E${episode.number}`;
    return episode.name ? `${code} · ${episode.name}` : code;
  }
  const first = episodes[0];
  const last = episodes[episodes.length - 1];
  const consecutive = episodes.every((episode, index) =>
    episode.season === first.season && episode.number === first.number + index
  );
  const range = consecutive ? ` · S${first.season} E${first.number}-E${last.number}` : "";
  return `${episodes.length} new episodes${range}`;
}

function makeCard(key: string, show: UserShow, entries: Array<{ episode: UserEpisode; time: Date }>): ScheduleCard {
  const sorted = entries.slice().sort((a, b) => compareEpisodeOrder(a.episode, b.episode));
  const releaseTime = new Date(Math.min(...entries.map(entry => entry.time.getTime())));
  return {
    key,
    show,
    episodes: sorted.map(entry => entry.episode),
    releaseTime,
    hasTime: entries.some(entry => Boolean(entry.episode.airstamp)),
    premiere: premiereLabel(show, sorted[0].episode)
  };
}

function byTimeThenName(a: ScheduleCard, b: ScheduleCard) {
  return a.releaseTime.getTime() - b.releaseTime.getTime() || a.show.name.localeCompare(b.show.name);
}

function whenLabel(card: ScheduleCard, now: Date): string {
  const days = differenceInCalendarDays(card.releaseTime, now);
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : days < SCHEDULE_DAYS ? format(card.releaseTime, "EEEE") : format(card.releaseTime, "MMM d");
  return card.hasTime && days < SCHEDULE_DAYS ? `${day} ${format(card.releaseTime, "h:mm a")}` : day;
}

export function buildComingSchedule(
  shows: UserShow[],
  episodesMap: Record<string, UserEpisode[]>,
  now: Date = new Date()
): ComingSchedule {
  const weekEnd = startOfDay(addDays(now, SCHEDULE_DAYS));
  const days = new Map<string, ScheduleCard[]>();
  const months = new Map<string, { title: string; cards: ScheduleCard[] }>();
  const recent: RecentCard[] = [];

  shows.forEach(show => {
    const episodes = getTrackableEpisodes(episodesMap[show.id] || [], false);
    const future = episodes
      .map(episode => ({ episode, time: getEpisodeReleaseTime(episode) }))
      .filter((entry): entry is { episode: UserEpisode; time: Date } => Boolean(entry.time && entry.time > now))
      .sort((a, b) => a.time.getTime() - b.time.getTime() || compareEpisodeOrder(a.episode, b.episode));

    const thisWeek = future.filter(entry => entry.time < weekEnd);
    const byDay = new Map<string, Array<{ episode: UserEpisode; time: Date }>>();
    thisWeek.forEach(entry => {
      const dayKey = format(entry.time, "yyyy-MM-dd");
      byDay.set(dayKey, [...(byDay.get(dayKey) || []), entry]);
    });
    byDay.forEach((entries, dayKey) => {
      days.set(dayKey, [...(days.get(dayKey) || []), makeCard(`${dayKey}:${show.id}`, show, entries)]);
    });

    // Shows not on this week's schedule appear once, under the month of their next episode.
    if (thisWeek.length === 0 && future.length > 0) {
      const next = future[0];
      const monthKey = format(next.time, "yyyy-MM");
      const month = months.get(monthKey) || { title: scheduleMonthTitle(next.time, now), cards: [] };
      month.cards.push(makeCard(`${monthKey}:${show.id}`, show, [next]));
      months.set(monthKey, month);
    }

    if (!show.isMovie) {
      const backlog = buildEpisodeBacklog(episodes, show.runtime || 0, now);
      const recentEpisodes = backlog.unwatchedEpisodes.filter(episode => {
        const time = getEpisodeReleaseTime(episode);
        return Boolean(time && time <= now && now.getTime() - time.getTime() <= RECENT_EPISODE_WINDOW_MS);
      });
      if (recentEpisodes.length > 0 && backlog.firstUnwatched) {
        const latestRelease = new Date(Math.max(...recentEpisodes.map(episode => getEpisodeReleaseTime(episode)!.getTime())));
        recent.push({
          key: `recent:${show.id}`,
          show,
          episodes: recentEpisodes.slice().sort(compareEpisodeOrder),
          latestRelease,
          playEpisode: backlog.firstUnwatched
        });
      }
    }
  });

  const week = Array.from(days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, cards]) => ({
      key: dayKey,
      title: scheduleDayTitle(cards[0].releaseTime, now),
      cards: cards.sort(byTimeThenName)
    }));
  const later = Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, month]) => ({ key: monthKey, title: month.title, cards: month.cards.sort(byTimeThenName) }));
  recent.sort((a, b) => b.latestRelease.getTime() - a.latestRelease.getTime() || a.show.name.localeCompare(b.show.name));

  const episodesThisWeek = week.reduce((total, group) =>
    total + group.cards.reduce((sum, card) => sum + (card.show.isMovie ? 0 : card.episodes.length), 0), 0);
  const firstUpcoming = week[0]?.cards[0] || later[0]?.cards[0];
  const summaryParts: string[] = [];
  if (episodesThisWeek > 0) {
    summaryParts.push(`${episodesThisWeek} ${episodesThisWeek === 1 ? "episode" : "episodes"} this week`);
  } else if (week.length === 0 && firstUpcoming) {
    summaryParts.push("Nothing airing this week");
  }
  if (firstUpcoming) summaryParts.push(`next: ${firstUpcoming.show.name}, ${whenLabel(firstUpcoming, now)}`);
  const summary = summaryParts.length > 0
    ? summaryParts.join(" · ")
    : "No upcoming episodes announced for your shows yet.";

  const today = startOfDay(now);
  const weekDays: ScheduleDay[] = Array.from({ length: SCHEDULE_DAYS }, (_, offset) => {
    const date = addDays(today, offset);
    const key = format(date, "yyyy-MM-dd");
    return {
      key,
      date,
      title: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : format(date, "EEEE"),
      subtitle: format(date, "MMM d"),
      isToday: offset === 0,
      cards: week.find(group => group.key === key)?.cards || []
    };
  });
  const laterCards = later.flatMap(group => group.cards);

  return { recent, week, weekDays, later, laterCards, summary, episodesThisWeek };
}
