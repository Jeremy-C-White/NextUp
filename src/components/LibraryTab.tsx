import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { UserShow, UserEpisode } from "../types";
import { calculateProgress } from "../lib/episodes";
import { optimizeArtworkUrl } from "../lib/images";
import { ProgressRing } from "./ProgressRing";
import { buildEpisodeBacklog, formatCatchUpDuration, hasRecentUnwatchedEpisode } from "../lib/episodeBacklog";

const librarySortOptions = [
  { value: "added", label: "Recently Added", tvLabel: "Recent" },
  { value: "name", label: "Alphabetical", tvLabel: "A–Z" },
  { value: "progress", label: "Progress", tvLabel: "Progress" },
  { value: "backlog", label: "Most Episodes to Catch Up", tvLabel: "Backlog" },
  { value: "queue", label: "Up Next Queue", tvLabel: "Queue" }
] as const;

interface LibraryTabProps {
  filteredLibrary: UserShow[];
  shows: UserShow[];
  episodesMap: Record<string, UserEpisode[]>;
  setDetailsShow: (show: UserShow) => void;
  libraryFilter: string;
  setLibraryFilter: (f: any) => void;
  librarySort: string;
  setLibrarySort: (s: any) => void;
  librarySearch: string;
  setLibrarySearch: (s: string) => void;
  playbackPercentageByShow: ReadonlyMap<string, number>;
}

export function LibraryTab({
  filteredLibrary,
  shows,
  episodesMap,
  setDetailsShow,
  libraryFilter,
  setLibraryFilter,
  librarySort,
  setLibrarySort,
  librarySearch,
  setLibrarySearch,
  playbackPercentageByShow
}: LibraryTabProps) {
  const { epsTotal, hoursTotal, topShow } = useMemo(() => {
    let watchedEpisodeCount = 0;
    let watchedMinutes = 0;
    const watchCounts = new Map<string, { name: string; count: number }>();
    const showByIdentity = new Map<string, UserShow>();
    shows.forEach(show => {
      showByIdentity.set(String(show.id), show);
      if (show.tvmazeId !== undefined) showByIdentity.set(String(show.tvmazeId), show);
      if (show.imdbId) showByIdentity.set(show.imdbId, show);
    });

    Object.values(episodesMap).forEach(showEpisodes => {
      showEpisodes.forEach(episode => {
        if (!episode.watched) return;
        watchedEpisodeCount += 1;
        watchedMinutes += episode.runtime || 0;
        const identity = String(episode.showId);
        const show = showByIdentity.get(identity);
        if (!show) return;
        const current = watchCounts.get(String(show.id));
        watchCounts.set(String(show.id), {
          name: show.name,
          count: (current?.count || 0) + 1
        });
      });
    });

    let mostWatched: { name: string; count: number } | undefined;
    watchCounts.forEach(value => {
      if (!mostWatched || value.count > mostWatched.count) mostWatched = value;
    });
    return {
      epsTotal: watchedEpisodeCount,
      hoursTotal: Math.round(watchedMinutes / 60),
      topShow: mostWatched
    };
  }, [episodesMap, shows]);

  return (
    <section className="space-y-6">
      <div data-tv-section="library-controls" className="mb-6">
        <div className="mb-5">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">Your library</h2>
          <p className="text-slate-600 dark:text-slate-400">Your saved movies and series.</p>
        </div>

        <div className="flex flex-col gap-3">
          <div data-tv-row="true" className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {(['all', 'watching', 'behind', 'new', 'caught-up', 'ended', 'movies'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setLibraryFilter(filter)}
                aria-pressed={libraryFilter === filter}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-base font-bold rounded-xl transition-colors ${libraryFilter === filter ? "bg-orange-500 text-orange-950" : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}
              >
                {filter === 'all' ? 'All' : filter === 'watching' ? 'Watching' : filter === 'behind' ? 'Behind' : filter === 'new' ? 'New' : filter === 'caught-up' ? 'Caught Up' : filter === 'ended' ? 'Ended' : 'Movies'}
              </button>
            ))}
          </div>

          <div data-tv-row="true" className="flex flex-wrap items-center gap-2">
            <input 
              type="text" 
              placeholder="Search library..." 
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base rounded-lg px-4 py-2 w-full md:w-48 focus:outline-none focus:border-orange-500"
            />
            <select 
              data-tv-native-sort="true"
              data-tv-ignore="true"
              aria-label="Sort your library"
              value={librarySort} 
              onChange={(e) => setLibrarySort(e.target.value as any)}
              className="bg-slate-200 dark:bg-slate-800 text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {librarySortOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div data-tv-sort-buttons="true" role="group" aria-label="Sort your library">
              {librarySortOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={librarySort === option.value}
                  onClick={() => setLibrarySort(option.value)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-base font-bold transition-colors ${
                    librarySort === option.value
                      ? "bg-orange-500 text-orange-950"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {option.tvLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div data-tv-grid="true" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredLibrary.map((show) => {
          const eps = episodesMap[show.id] || [];
          const pct = calculateProgress(eps).percentage;
          const progressLoaded = Object.prototype.hasOwnProperty.call(episodesMap, show.id);
          const backlog = buildEpisodeBacklog(eps, show.runtime || 0);
          const catchUpTime = formatCatchUpDuration(backlog.remainingMinutes);
          const statusLabel = show.isMovie
            ? (pct === 100 ? "Movie · Watched" : "Movie")
            : !progressLoaded
              ? "Loading progress"
              : backlog.unwatchedCount === 0
                ? "Caught up"
                : backlog.unwatchedCount === 1 && hasRecentUnwatchedEpisode(backlog)
                  ? "1 new episode"
                  : backlog.unwatchedCount === 1
                    ? "1 unwatched"
                    : `${backlog.unwatchedCount} to catch up${catchUpTime ? ` · ${catchUpTime}` : ""}`;
          const partialPlayback = playbackPercentageByShow.get(show.id) ?? null;
          return (
            <div key={show.id} data-tv-card="true" data-tv-poster-card="true" className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-[2/3] hover:border-orange-500/50 transition-colors flex flex-col text-left">
              <button data-tv-focus-key={`library:${show.id}`} onClick={() => setDetailsShow(show)} className="absolute inset-0 z-10 touch-manipulation">
                <span className="sr-only">View Details for {show.name}</span>
              </button>
              <ProgressRing percentage={partialPlayback} size="small" className="absolute top-4 right-4 z-20 pointer-events-none" />
              {show.imageUrl ? (
                <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={optimizeArtworkUrl(show.imageUrl, "poster")} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-800">{show.name?.[0] || "?"}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                <span data-tv-library-status="true" className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-1">
                  {statusLabel}
                </span>
                <h3 className="text-white font-display font-bold leading-tight line-clamp-2">{show.name}</h3>
              </div>
            </div>
          )
        })}
      </div>

      {epsTotal > 0 && (
        <div data-tv-watch-stats="true" className="mt-10 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">Watch stats</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Your all-time overview</p>
          </div>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <div>
              <div className="text-4xl md:text-5xl font-display font-bold text-orange-400">{epsTotal}</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Episodes</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-display font-bold text-indigo-400">{hoursTotal}</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Hours</div>
            </div>
            {topShow && (
              <div>
                <div className="text-xl font-bold text-slate-900 dark:text-white max-w-[220px] leading-tight pt-1.5">{topShow.name}</div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Most watched</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {filteredLibrary.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center mt-6">
          <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Saved Movies or Shows</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
            {shows.length === 0 
               ? "You haven't added any series or movies to your library yet. Use the Search tab or browse the Discover section to find your favorite titles!" 
               : "No titles match your current filter or search criteria. Try changing your filters above!"}
          </p>
        </div>
      )}
    </section>
  );
}
