import { format, formatDistanceToNow } from "date-fns";
import { Calendar, PlayCircle } from "lucide-react";
import { UserEpisode, UserShow } from "../types";
import { optimizeArtworkUrl } from "../lib/images";
import { ComingSchedule, describeEpisodes, RecentCard, ScheduleCard, ScheduleDay } from "../lib/comingSchedule";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { ScrollRow } from "./ScrollRow";

interface ComingTabProps {
  schedule: ComingSchedule;
  onOpenDetails: (show: UserShow) => void;
  onPlayEpisode: (show: UserShow, episode: UserEpisode) => void;
  /** Keeps each row's scroll position per user. */
  rowStorageKeyPrefix?: string;
}
function isTvLayout(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("tv-mode");
}

function providerName(show: UserShow): string | null {
  return show.provider && show.provider !== "Unknown" && show.provider !== "Unknown Provider" ? show.provider : null;
}

/** Wide artwork for a tile: the episode still, then the show's backdrop, then its poster. */
function tileArtwork(show: UserShow, episode?: UserEpisode): string {
  return optimizeArtworkUrl(episode?.imageUrl || show.backdropUrl || show.imageUrl, "poster");
}

function TileImage({ src, name }: { src: string; name: string }) {
  return src ? (
    <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={src} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-5xl font-display font-bold text-slate-600 pointer-events-none">
      {name?.[0] || "?"}
    </div>
  );
}

/** Short labels for small tiles: "S2 premiere", "Series premiere". */
function shortPremiere(card: ScheduleCard): string | null {
  if (!card.premiere) return null;
  const [first] = card.episodes;
  return first.season <= 1 ? "Series premiere" : `S${first.season} premiere`;
}

/** "S2 E4", or "S1 E1-E3" / "3 episodes" when several air together. */
function shortEpisodes(card: ScheduleCard): string {
  if (card.show.isMovie) return "Movie";
  const first = card.episodes[0];
  if (card.episodes.length === 1) return `S${first.season} E${first.number}`;
  const last = card.episodes[card.episodes.length - 1];
  const consecutive = card.episodes.every((episode, index) => episode.season === first.season && episode.number === first.number + index);
  return consecutive ? `S${first.season} E${first.number}-E${last.number}` : `${card.episodes.length} episodes`;
}

function PremiereBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span data-tv-premiere-badge="true" className="inline-flex px-2 py-0.5 rounded-md bg-orange-500 text-orange-950 text-[11px] font-extrabold uppercase tracking-wider shadow">
      {label}
    </span>
  );
}

export function ComingTab({ schedule, onOpenDetails, onPlayEpisode, rowStorageKeyPrefix = "" }: ComingTabProps) {
  const showCalendar = !isTvLayout();
  const hasAnything = schedule.recent.length > 0 || schedule.week.length > 0 || schedule.laterCards.length > 0;

  // Recently aired: a big artwork tile; OK plays the next unwatched episode.
  const renderRecentTile = (card: RecentCard) => {
    const newest = card.episodes[card.episodes.length - 1];
    const detail = card.episodes.length === 1
      ? describeEpisodes(card.show, card.episodes)
      : `${card.episodes.length} new episodes · latest S${newest.season} E${newest.number}`;
    const play = `S${card.playEpisode.season} E${card.playEpisode.number}`;
    return (
      <div
        key={card.key}
        data-tv-card="true"
        data-tv-poster-card="true"
        data-tv-wide-tile="recent"
        className="relative shrink-0 w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-2xl overflow-hidden bg-slate-900 text-left group"
      >
        <button
          data-tv-focus-key={`recently-aired:${card.show.id}`}
          onClick={() => onPlayEpisode(card.show, card.playEpisode)}
          className="absolute inset-0 z-10 touch-manipulation"
        >
          <span className="sr-only">Play {card.show.name} {play}. {detail}. Aired {formatDistanceToNow(card.latestRelease, { addSuffix: true })}.</span>
        </button>
        <TileImage src={tileArtwork(card.show, card.episodes.length === 1 ? newest : undefined)} name={card.show.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent pointer-events-none" />
        {card.episodes.length > 1 && (
          <span className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg bg-orange-500 text-orange-950 text-xs font-extrabold pointer-events-none">
            {card.episodes.length} NEW
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300 mb-1">
            Aired {formatDistanceToNow(card.latestRelease, { addSuffix: true })}
          </div>
          <h4 className="text-white text-2xl font-display font-bold leading-tight truncate">{card.show.name}</h4>
          <p className="text-slate-200 text-sm font-semibold truncate mt-0.5">{detail}</p>
          <span data-tv-tile-action="true" className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/15 text-white text-sm font-bold">
            <PlayCircle className="w-4 h-4" /> Play {play}
          </span>
        </div>
      </div>
    );
  };

  // This week: one column per day, like a TV guide.
  const renderWeekTile = (card: ScheduleCard) => {
    const [firstEpisode] = card.episodes;
    const provider = providerName(card.show);
    const time = card.hasTime ? format(card.releaseTime, "h:mm a") : null;
    return (
      <div
        key={card.key}
        data-tv-card="true"
        data-tv-poster-card="true"
        data-tv-coming-card="week"
        className="relative rounded-2xl overflow-hidden bg-slate-900 text-left group"
      >
        <button
          data-tv-focus-key={`coming:week:${card.key}`}
          onClick={() => onOpenDetails(card.show)}
          className="absolute inset-0 z-10 touch-manipulation"
        >
          <span className="sr-only">{card.show.name}, {describeEpisodes(card.show, card.episodes)}{time ? `, ${time}` : ""}</span>
        </button>
        <div className="relative aspect-video overflow-hidden">
          <TileImage src={tileArtwork(card.show, card.episodes.length === 1 ? firstEpisode : undefined)} name={card.show.name} />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
          {time && (
            <span className="absolute bottom-2 left-2 z-20 px-2 py-0.5 rounded-md bg-slate-950/85 text-orange-300 text-xs font-extrabold pointer-events-none">{time}</span>
          )}
          <div className="absolute top-2 left-2 z-20 pointer-events-none"><PremiereBadge label={shortPremiere(card)} /></div>

        </div>
        <div className="p-3 pointer-events-none">
          <h5 className="text-white text-lg font-display font-bold leading-tight line-clamp-2">{card.show.name}</h5>
          <p className="text-slate-300 text-sm font-semibold mt-1 truncate">{shortEpisodes(card)}</p>
          {provider && <p className="text-slate-500 text-xs font-semibold mt-0.5 truncate">{provider}</p>}
        </div>
        {showCalendar && card.episodes.length === 1 && (
          <div className="px-3 pb-3 relative z-20">
            <AddToCalendarButton
              showName={card.show.name}
              season={firstEpisode.season}
              number={firstEpisode.number}
              epTitle={firstEpisode.name}
              airstamp={card.releaseTime.toISOString()}
              runtimeMinutes={card.show.runtime}
            />
          </div>
        )}
      </div>
    );
  };

  const renderDay = (day: ScheduleDay) => (
    <div key={day.key} data-tv-week-day={day.key} className="min-w-0">
      <div className={`mb-3 pb-2 border-b-2 ${day.isToday ? "border-orange-500" : "border-slate-300 dark:border-slate-700"}`}>
        <div className={`text-xl font-display font-bold ${day.isToday ? "text-orange-400" : "text-slate-900 dark:text-white"}`}>{day.title}</div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{day.subtitle}</div>
      </div>
      <div className="space-y-4">
        {day.cards.length > 0
          ? day.cards.map(renderWeekTile)
          : <p className="text-sm font-semibold text-slate-400 dark:text-slate-600 pt-2">Nothing airing</p>}
      </div>
    </div>
  );

  // Later: artwork tiles in date order, each with a calendar-style date.
  const renderLaterTile = (card: ScheduleCard) => {
    const [firstEpisode] = card.episodes;
    return (
      <div
        key={card.key}
        data-tv-card="true"
        data-tv-poster-card="true"
        data-tv-wide-tile="later"
        className="relative shrink-0 w-[280px] md:w-[320px] lg:w-[360px] aspect-video rounded-2xl overflow-hidden bg-slate-900 text-left group"
      >
        <button
          data-tv-focus-key={`coming:later:${card.key}`}
          onClick={() => onOpenDetails(card.show)}
          className="absolute inset-0 z-10 touch-manipulation"
        >
          <span className="sr-only">{card.show.name}, {describeEpisodes(card.show, card.episodes)}, {format(card.releaseTime, "MMMM d")}</span>
        </button>
        <TileImage src={tileArtwork(card.show)} name={card.show.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent pointer-events-none" />
        <div data-tv-date-chip="true" className="absolute top-3 left-3 z-20 w-16 rounded-xl overflow-hidden text-center bg-slate-950/90 border border-white/10 pointer-events-none">
          <div className="bg-orange-500 text-orange-950 text-[11px] font-extrabold uppercase tracking-wider py-0.5">{format(card.releaseTime, "MMM")}</div>
          <div className="text-white text-2xl font-display font-bold leading-none py-1.5">{format(card.releaseTime, "d")}</div>
        </div>
        <div className="absolute top-3 right-3 z-20 pointer-events-none"><PremiereBadge label={card.premiere} /></div>
        <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
          <h4 className="text-white text-xl font-display font-bold leading-tight truncate">{card.show.name}</h4>
          <p className="text-slate-200 text-sm font-semibold truncate mt-0.5">
            {card.show.isMovie ? "Movie" : `S${firstEpisode.season} E${firstEpisode.number}`} · in {formatDistanceToNow(card.releaseTime)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section data-tv-coming-screen="true" className="space-y-12">
      <div>
        <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">Coming up</h2>
        <p data-tv-coming-summary="true" className="text-slate-600 dark:text-slate-400">{schedule.summary}</p>
      </div>

      {schedule.recent.length > 0 && (
        <div data-tv-section="true" data-tv-coming-part="recent" className="[content-visibility:auto] [contain-intrinsic-size:auto_360px]">
          <div className="mb-4">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">Recently aired</h3>
            <p className="text-slate-600 dark:text-slate-400 text-base">Unwatched episodes from the last two weeks. Select one to play the next episode.</p>
          </div>
          <ScrollRow storageKey={`${rowStorageKeyPrefix}coming:recent`}>
            {schedule.recent.map(renderRecentTile)}
          </ScrollRow>
        </div>
      )}

      <div data-tv-section="coming-week" data-tv-free-nav="true" data-tv-heading-group="true" data-tv-coming-part="week">
        <div data-tv-group-heading="true" className="mb-5">
          <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">This week</h3>
        </div>
        <div data-tv-week-grid="true" className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-4 overflow-x-auto scrollbar-none pb-2">
          {schedule.weekDays.map(renderDay)}
        </div>
      </div>

      {schedule.laterCards.length > 0 && (
        <div data-tv-section="true" data-tv-coming-part="later" className="[content-visibility:auto] [contain-intrinsic-size:auto_320px]">
          <div className="mb-4">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">Later</h3>
            <p className="text-slate-600 dark:text-slate-400 text-base">The next announced episode for each of your other shows.</p>
          </div>
          <ScrollRow storageKey={`${rowStorageKeyPrefix}coming:later`}>
            {schedule.laterCards.map(renderLaterTile)}
          </ScrollRow>
        </div>
      )}

      {!hasAnything && (
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Calendar className="w-5 h-5" />
          <span>New dates appear here as soon as they are announced.</span>
        </div>
      )}
    </section>
  );
}
