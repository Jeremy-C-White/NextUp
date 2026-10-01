import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { UserShow, UserEpisode } from "../types";
import { optimizeArtworkUrl } from "../lib/images";
import { ProgressRing } from "./ProgressRing";
import { ScrollRow } from "./ScrollRow";
import {
  classifyLibraryShow,
  LIBRARY_SHELVES,
  LibraryFilter,
  LibraryShelfId,
  LibraryShelfPlacement
} from "../lib/libraryShelves";

const librarySortOptions = [
  { value: "added", label: "Recently Added", tvLabel: "Recent" },
  { value: "name", label: "Alphabetical", tvLabel: "A–Z" },
  { value: "progress", label: "Progress", tvLabel: "Progress" },
  { value: "backlog", label: "Most Episodes to Catch Up", tvLabel: "Backlog" },
  { value: "queue", label: "Up Next Queue", tvLabel: "Queue" }
] as const;

interface LibraryTabProps {
  /** The whole Library, already searched and sorted. */
  filteredLibrary: UserShow[];
  shows: UserShow[];
  episodesMap: Record<string, UserEpisode[]>;
  setDetailsShow: (show: UserShow) => void;
  libraryFilter: LibraryFilter;
  setLibraryFilter: (filter: LibraryFilter) => void;
  librarySort: string;
  setLibrarySort: (s: any) => void;
  librarySearch: string;
  setLibrarySearch: (s: string) => void;
  playbackPercentageByShow: ReadonlyMap<string, number>;
  /** Keeps each row's scroll position per user. */
  rowStorageKeyPrefix?: string;
}
interface LibraryPosterCardProps {
  show: UserShow;
  placement: LibraryShelfPlacement | undefined;
  partialPlayback: number | null;
  onOpen: (show: UserShow) => void;
  inRow?: boolean;
}

function LibraryPosterCard({ show, placement, partialPlayback, onOpen, inRow = false }: LibraryPosterCardProps) {
  return (
    <div
      data-tv-card="true"
      data-tv-poster-card="true"
      className={`group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-[2/3] hover:border-orange-500/50 transition-colors flex flex-col text-left ${inRow ? "snap-start shrink-0 w-40 md:w-48 lg:w-56" : ""}`}
    >
      <button data-tv-focus-key={`library:${show.id}`} onClick={() => onOpen(show)} className="absolute inset-0 z-10 touch-manipulation">
        <span className="sr-only">View Details for {show.name}</span>
      </button>
      <ProgressRing percentage={partialPlayback} size="small" className="absolute top-4 right-4 z-20 pointer-events-none" />
      {show.imageUrl ? (
        <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={optimizeArtworkUrl(show.imageUrl, "poster")} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-800">{show.name?.[0] || "?"}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end pointer-events-none">
        {placement?.note && (
          <span data-tv-library-status="true" className="text-xs font-bold text-orange-300 mb-1">
            {placement.note}
          </span>
        )}
        <h3 className="text-white font-display font-bold leading-tight line-clamp-2">{show.name}</h3>
        {placement?.detail && (
          <p data-tv-library-detail="true" className="text-slate-300 text-sm font-semibold mt-1">{placement.detail}</p>
        )}
      </div>
    </div>
  );
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
  playbackPercentageByShow,
  rowStorageKeyPrefix = ""
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

  // Which shelf every title is on, with its poster note.
  const placements = useMemo(() => {
    const now = new Date();
    const result = new Map<string, LibraryShelfPlacement>();
    shows.forEach(show => {
      const episodes = Object.prototype.hasOwnProperty.call(episodesMap, show.id) ? episodesMap[show.id] : undefined;
      result.set(show.id, classifyLibraryShow(show, episodes, {
        now,
        partialPlayback: playbackPercentageByShow.get(show.id) ?? null
      }));
    });
    return result;
  }, [episodesMap, playbackPercentageByShow, shows]);

  const shelfCounts = useMemo(() => {
    const counts = new Map<LibraryShelfId, number>();
    placements.forEach(placement => counts.set(placement.shelf, (counts.get(placement.shelf) || 0) + 1));
    return counts;
  }, [placements]);

  const searching = librarySearch.trim().length > 0;
  const showRows = libraryFilter === "all" && !searching;
  const shelves = useMemo(() => LIBRARY_SHELVES.map(shelf => ({
    ...shelf,
    shows: filteredLibrary.filter(show => placements.get(show.id)?.shelf === shelf.id)
  })).filter(shelf => shelf.shows.length > 0), [filteredLibrary, placements]);
  const gridShows = libraryFilter === "all"
    ? filteredLibrary
    : filteredLibrary.filter(show => placements.get(show.id)?.shelf === libraryFilter);
  const activeShelf = LIBRARY_SHELVES.find(shelf => shelf.id === libraryFilter);

  const allFilterButtons: Array<{ id: LibraryFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: shows.length },
    ...LIBRARY_SHELVES.map(shelf => ({ id: shelf.id as LibraryFilter, label: shelf.label, count: shelfCounts.get(shelf.id) || 0 }))
  ];
  // Empty shelves get no button (unless it is the one currently chosen).
  const filterButtons = allFilterButtons.filter(button => button.id === "all" || button.count > 0 || button.id === libraryFilter);

  const summaryParts = [
    `${shows.length} ${shows.length === 1 ? "title" : "titles"}`,
    epsTotal > 0 ? `${epsTotal} ${epsTotal === 1 ? "episode" : "episodes"} watched` : "",
    hoursTotal > 0 ? `${hoursTotal} ${hoursTotal === 1 ? "hour" : "hours"}` : "",
    topShow ? `Most watched: ${topShow.name}` : ""
  ].filter(Boolean);

  const renderCard = (show: UserShow, inRow: boolean) => (
    <LibraryPosterCard
      key={show.id}
      show={show}
      placement={placements.get(show.id)}
      partialPlayback={playbackPercentageByShow.get(show.id) ?? null}
      onOpen={setDetailsShow}
      inRow={inRow}
    />
  );

  return (
    <section className="space-y-6">
      <div data-tv-section="library-controls" className="mb-6">
        <div className="mb-5">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">Your library</h2>
          <p data-tv-library-summary="true" className="text-slate-600 dark:text-slate-400">
            {shows.length === 0 ? "Your saved movies and series." : summaryParts.join(" · ")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div data-tv-row="true" className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {filterButtons.map(button => (
              <button
                key={button.id}
                type="button"
                onClick={() => setLibraryFilter(button.id)}
                aria-pressed={libraryFilter === button.id}
                aria-label={`${button.label}, ${button.count} ${button.count === 1 ? "title" : "titles"}`}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-base font-bold rounded-xl transition-colors ${libraryFilter === button.id ? "bg-orange-500 text-orange-950" : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}
              >
                {button.label}
                <span data-tv-filter-count="true" className="ml-2 inline-flex min-w-[1.75rem] justify-center rounded-full bg-black/15 px-2 text-sm tabular-nums">
                  {button.count}
                </span>
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

      {showRows ? (
        <div data-tv-library-shelves="true" className="space-y-12">
          {shelves.map(shelf => (
            <div
              key={shelf.id}
              data-tv-section="true"
              data-tv-library-shelf={shelf.id}
              className="[content-visibility:auto] [contain-intrinsic-size:auto_480px]"
            >
              <div className="mb-4 flex items-baseline gap-3">
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">{shelf.title}</h3>
                <span data-tv-shelf-count="true" className="text-slate-500 dark:text-slate-400 text-base font-semibold tabular-nums">{shelf.shows.length}</span>
              </div>
              <ScrollRow storageKey={`${rowStorageKeyPrefix}library:${shelf.id}`}>
                {shelf.shows.map(show => renderCard(show, true))}
              </ScrollRow>
            </div>
          ))}
        </div>
      ) : (
        <div data-tv-grid="true" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {gridShows.map(show => renderCard(show, false))}
        </div>
      )}

      {shows.length > 0 && (showRows ? shelves.length === 0 : gridShows.length === 0) && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center mt-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nothing here</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {searching
              ? `No titles match "${librarySearch.trim()}"${activeShelf ? ` in ${activeShelf.title}` : ""}.`
              : activeShelf?.empty || "No titles to show."}
          </p>
        </div>
      )}

      {shows.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center mt-6">
          <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Saved Movies or Shows</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
            You haven't added any series or movies to your library yet. Use the Search tab or browse the Discover section to find your favorite titles!
          </p>
        </div>
      )}
    </section>
  );
}
