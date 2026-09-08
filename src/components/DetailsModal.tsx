import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, PlayCircle, Trash2, ExternalLink, Sparkles, ThumbsUp, Ban, Eye } from "lucide-react";
import { UserShow, UserEpisode } from "../types";
import { ExpandableText } from "./ExpandableText";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { getTMDBIdFromIMDB, getWatchProviders, getTMDBExternalIds, getTMDBMovieDetails, TMDBMovieDetails } from "../lib/tmdb";
import { resolveTVMazeShow, getEpisodes } from "../lib/tvmaze";
import { getEpisodeReleaseTime, isEpisodeReleased, getReleasedEpisodes } from "../lib/episodes";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { removeUndefined } from "../lib/library";
import { formatPlaybackPosition } from "../lib/playbackProgress";
import { optimizeArtworkUrl } from "../lib/images";
import { firstPositiveNumber, formatRuntimeMinutes } from "../lib/mediaMetadata";
import type { RecommendationFeedbackKind } from "../lib/recommendationPreferences";
import { isTvBackKey } from "../lib/webos";

interface Props {
  show: UserShow;
  episodes: UserEpisode[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: () => Promise<void> | void;
  onToggleWatched: (episodeId: string, watched: boolean) => void;
  onMarkThrough: (episodeIds: string[]) => void;
  onSetProgress?: (lastWatchedEpisodeId: string | null) => void;
  inLibrary?: boolean;
  onAdd?: (caughtUp: boolean) => void;
  addingShowId?: number | null;
  onPlayEpisode?: (showId: string, imdbId: string | undefined, episode: UserEpisode) => void;
  getResumePosition?: (showId: string, episodeId: string) => number | null;
  recommendationReason?: string | null;
  recommendationFeedback?: RecommendationFeedbackKind;
  onRecommendationFeedback?: (kind: RecommendationFeedbackKind) => void;
}

export function DetailsModal({ show, episodes, isOpen, onClose, onRemove, onToggleWatched, onMarkThrough, onSetProgress, inLibrary, onAdd, addingShowId, onPlayEpisode, getResumePosition, recommendationReason, recommendationFeedback, onRecommendationFeedback }: Props) {
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedEpForStreams, setSelectedEpForStreams] = useState<UserEpisode | null>(null);
  const [resolvingStream, setResolvingStream] = useState(false);
  const [previewEps, setPreviewEps] = useState<UserEpisode[] | null>(null);
  const [epsLoading, setEpsLoading] = useState(false);
  const [isCheckingImdb, setIsCheckingImdb] = useState(false);
  const [checkedImdb, setCheckedImdb] = useState(false);
  const [resolvedLocalImdb, setResolvedLocalImdb] = useState<string | null>(null);
  const [movieDetails, setMovieDetails] = useState<TMDBMovieDetails | null>(null);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [progressNotice, setProgressNotice] = useState<string | null>(null);
  const cancelRemoveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setResolvedLocalImdb(null);
      setMovieDetails(null);
      setShowRemoveConfirmation(false);
      setIsRemoving(false);
      setProgressNotice(null);
    }
  }, [isOpen, show.id]);

  useEffect(() => {
    if (!isOpen || !show.isMovie) {
      setMovieDetails(null);
      return;
    }

    const numericId = typeof show.id === "string" ? parseInt(show.id, 10) : show.id;
    const tmdbId = show._tmdbId || (numericId < -1000000000 ? -numericId - 1000000000 : undefined);
    if (!tmdbId) return;

    let active = true;
    getTMDBMovieDetails(tmdbId).then(details => {
      if (!active) return;
      setMovieDetails(details);
      if (details.imdbId) setResolvedLocalImdb(current => current || details.imdbId || null);

      if (inLibrary !== false && auth.currentUser) {
        const showRef = doc(db, `users/${auth.currentUser.uid}/shows/${show.id}`);
        void setDoc(showRef, removeUndefined({
          runtime: details.runtime,
          genres: details.genres.length > 0 ? details.genres : undefined,
          vote_average: details.voteAverage,
          rating: details.voteAverage ? { average: details.voteAverage } : undefined,
          premiered: details.releaseDate,
          status: details.status,
          officialSite: details.homepage,
          imdbId: details.imdbId,
          _tmdbId: tmdbId
        }), { merge: true }).catch(error => console.warn("Could not save movie details", error));
      }
    }).catch(error => console.warn("Could not load movie details", error));

    return () => { active = false; };
  }, [inLibrary, isOpen, show._tmdbId, show.id, show.isMovie]);

  useEffect(() => {
    if (!showRemoveConfirmation) return;
    const frame = window.requestAnimationFrame(() => cancelRemoveButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [showRemoveConfirmation]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      if (inLibrary !== false && episodes.length > 0) {
        const unwatched = getReleasedEpisodes(episodes).filter(e => !e.watched);
        if (unwatched.length > 0) {
          setSeasonFilter(unwatched[0].season.toString());
        } else {
          setSeasonFilter("all");
        }
      } else {
        setSeasonFilter("all");
      }
      
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen, episodes, inLibrary]);

  useEffect(() => {
    if (isOpen) {
      const currentImdb = resolvedLocalImdb || show.imdbId;
      if (currentImdb && currentImdb !== "none") {
        getTMDBIdFromIMDB(currentImdb, Boolean(show.isMovie)).then(tmdbId => {
          if (tmdbId) {
            getWatchProviders(tmdbId, Boolean(show.isMovie)).then(setProviders).catch(console.error);
          }
        });
      } else {
        setProviders([]);
      }
    } else {
      setProviders([]);
    }
  }, [isOpen, show.imdbId, resolvedLocalImdb]);

  useEffect(() => {
    if (!isOpen) {
      setIsCheckingImdb(false);
      setCheckedImdb(false);
      return;
    }

    const numId = typeof show.id === 'string' ? parseInt(show.id, 10) : show.id;
    const tvmazeId = show.tvmazeId;
    const targetId = tvmazeId !== undefined ? tvmazeId : numId;
    
    const tmdbId = show._tmdbId || (show.isMovie && targetId < 0 ? (-targetId - 1000000000) : undefined);
    const currentImdb = show.imdbId;
    const isImdbNoneOrEmpty = !currentImdb || currentImdb === "none";

    if (show.isMovie && isImdbNoneOrEmpty && tmdbId) {
      setIsCheckingImdb(true);
      getTMDBExternalIds(tmdbId, true).then(async (extIds) => {
        if (extIds.imdb) {
          setResolvedLocalImdb(extIds.imdb);
          if (inLibrary !== false) {
            const showRef = doc(db, `users/${auth.currentUser?.uid}/shows/${show.id}`);
            await setDoc(showRef, removeUndefined({ imdbId: extIds.imdb, _tmdbId: tmdbId }), { merge: true });
          }
        } else {
          if (inLibrary !== false) {
            const showRef = doc(db, `users/${auth.currentUser?.uid}/shows/${show.id}`);
          }
        }
      }).catch(console.error)
      .finally(() => {
        setIsCheckingImdb(false);
        setCheckedImdb(true);
      });
    } else if (!show.isMovie && isImdbNoneOrEmpty) {
      setIsCheckingImdb(true);
      resolveTVMazeShow({ id: targetId || -1, name: show.name, _tmdbId: show._tmdbId, isMovie: false } as any).then(async (resolved) => {
        const imdbId = resolved.externals?.imdb;
        if (imdbId) {
          setResolvedLocalImdb(imdbId);
        }
        if (inLibrary !== false && auth.currentUser) {
          const showRef = doc(db, `users/${auth.currentUser.uid}/shows/${show.id}`);
          await setDoc(showRef, removeUndefined({
            imdbId: imdbId || undefined,
            ...(resolved.id > 0 ? { tvmazeId: resolved.id } : {})
          }), { merge: true });
        }
      }).catch(() => {
        // Ignore
      }).finally(() => {
        setIsCheckingImdb(false);
        setCheckedImdb(true);
      });
    } else {
      setIsCheckingImdb(false);
      setCheckedImdb(true);
    }
  }, [isOpen, show.isMovie, show.imdbId, show._tmdbId, show.id, show.tvmazeId, inLibrary]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && inLibrary === false && episodes.length === 0) {
      setEpsLoading(true);
      const isMovie = show.isMovie;
      Promise.resolve(isMovie ? [{id: "movie_"+show.id, season: 1, number: 1, name: "Movie", airstamp: new Date().toISOString()}] : resolveTVMazeShow({ id: show.tvmazeId, name: show.name, externals: { imdb: show.imdbId }, _tmdbId: show._tmdbId, isMovie: show.isMovie } as any).then(resolved => getEpisodes(resolved.id)))
        .then(eps => {
          setPreviewEps(eps.map(e => ({
            id: String(e.id),
            showId: show.tvmazeId,
            season: e.season,
            number: e.number,
            name: e.name,
            airdate: e.airdate || "",
            airstamp: e.airstamp || "",
            imageUrl: e.image?.medium || "",
            summary: e.summary || "",
            watched: false
          })));
        })
        .catch(() => setPreviewEps([]))
        .finally(() => setEpsLoading(false));
    }
  }, [isOpen, inLibrary, show.tvmazeId, show.name, show.imdbId, episodes.length, show.isMovie, (show as any).isMovie]);

  if (!isOpen) return null;

  const displayEpisodes = inLibrary !== false ? episodes : (previewEps ?? []);
  
  const seasons = Array.from(new Set(displayEpisodes.map(e => Number(e.season)))).sort((a: any, b: any) => b - a);
  const filteredEpisodes = displayEpisodes.filter(e => {
    if (seasonFilter === "all") return true;
    return e.season.toString() === seasonFilter;
  });
  const releasedEpisodes = getReleasedEpisodes(displayEpisodes);
  const releasedFilteredEpisodes = getReleasedEpisodes(filteredEpisodes);
  const watchedReleasedCount = releasedEpisodes.filter(episode => episode.watched).length;
  const progressPercentage = releasedEpisodes.length > 0
    ? Math.round((watchedReleasedCount / releasedEpisodes.length) * 100)
    : 0;
  const nextUnwatchedEpisode = releasedEpisodes.find(episode => !episode.watched);

  const displayRating = firstPositiveNumber(movieDetails?.voteAverage, show.rating?.average, show.vote_average);
  const displayRuntime = firstPositiveNumber(movieDetails?.runtime, show.runtime);
  const displayGenres = movieDetails?.genres.length ? movieDetails.genres : (show.genres || []);
  const displayPremiered = movieDetails?.releaseDate || show.premiered;
  const displayStatus = movieDetails?.status || (show.isMovie ? "Feature Film" : show.status);
  const displayOfficialSite = movieDetails?.homepage || show.officialSite;


  const handleToggleWatched = (episodeId: string, currentWatched: boolean) => {
    onToggleWatched(episodeId, !currentWatched);
  };

  const handleMarkThrough = (episodeId: string) => {
    const episodeIndex = episodes.findIndex(e => e.id === episodeId);
    if (episodeIndex === -1) return;
    const targetEpisode = episodes[episodeIndex];
    const toMark = episodes
      .slice(0, episodeIndex + 1)
      .filter(e => isEpisodeReleased(e) && !e.watched)
      .map(e => e.id);
    if (toMark.length > 0) {
      onMarkThrough(toMark);
      setProgressNotice(`Progress saved through S${targetEpisode.season} E${targetEpisode.number}. Up Next will move to your following aired episode.`);
    }
  };

  const handleSetProgress = (episode: UserEpisode) => {
    if (onSetProgress) onSetProgress(episode.id);
    else handleMarkThrough(episode.id);
    setProgressNotice(`Progress set through S${episode.season} E${episode.number}. The following aired episode is now Up Next.`);
  };

  const handleStartFromBeginning = () => {
    onSetProgress?.(null);
    setProgressNotice("Progress reset. Your first aired episode is now Up Next.");
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove();
    } catch {
      // The parent keeps the details open and displays the connection error.
    } finally {
      setIsRemoving(false);
    }
  };

  const handlePlayEpisode = async (episode: UserEpisode) => {
    if (onPlayEpisode) {
      onPlayEpisode(show.id, resolvedLocalImdb || show.imdbId, episode);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-slate-950/80 backdrop-blur-sm touch-manipulation overflow-hidden"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDownCapture={(event) => {
        if (!showRemoveConfirmation || !isTvBackKey(event.nativeEvent)) return;
        event.preventDefault();
        event.stopPropagation();
        setShowRemoveConfirmation(false);
      }}
    >
      <div data-tv-library-manager="true" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none md:rounded-3xl w-full max-w-[96rem] h-dvh md:h-[94dvh] max-h-dvh md:max-h-[94dvh] overflow-hidden shadow-2xl flex flex-col overscroll-contain animate-in" onClick={(e) => e.stopPropagation()}>
        <div data-tv-show-hero="true" className="relative min-h-[11rem] md:min-h-[12rem] bg-slate-950 shrink-0 flex flex-col justify-end px-5 pb-5 md:p-6 pt-[calc(3.5rem+env(safe-area-inset-top))]">
          {show.imageUrl && (
            <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={optimizeArtworkUrl(show.backdropUrl || show.imageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20 pointer-events-none" />
          
          <button onClick={onClose} aria-label="Close" className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-[calc(0.75rem+env(safe-area-inset-right))] md:top-4 md:right-4 w-11 h-11 flex items-center justify-center bg-slate-950/60 hover:bg-slate-800 rounded-full text-white backdrop-blur transition-colors z-50 touch-manipulation border border-white/10">
            <X className="w-6 h-6" />
          </button>

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 text-center sm:text-left w-full">
            {show.imageUrl ? (
              <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={optimizeArtworkUrl(show.imageUrl, "poster")} alt="" className="w-20 h-30 sm:w-24 sm:h-36 rounded-xl shadow-lg object-cover border border-slate-800 shrink-0" />
            ) : (
              <div className="w-20 h-30 sm:w-24 sm:h-36 bg-slate-800 rounded-xl flex items-center justify-center text-4xl font-bold text-white shrink-0">{show.name[0]}</div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <span className="text-orange-400 font-bold text-xs uppercase tracking-wider">{displayStatus}</span>
              <h2 className="text-2xl md:text-4xl font-display font-bold text-white leading-tight mt-1 mb-2 drop-shadow-md">{show.name}</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-slate-300">
                {displayPremiered && <span>Released {new Date(displayPremiered).getFullYear()}</span>}
                {displayRating !== null && (
                  <span className="flex items-center gap-1 text-orange-400 font-semibold">
                    ★ {displayRating.toFixed(1)}
                  </span>
                )}
                {displayGenres.length > 0 && (
                  <span className="text-slate-400">{displayGenres.slice(0, 2).join(", ")}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden overscroll-contain">
          <div data-tv-details-sidebar="true" className="w-full md:w-72 p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 md:shrink-0 md:overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Details</h3>
            <div className="space-y-4">
              {show.summary && (
                <div className="border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Overview</span>
                  <div className="text-slate-700 dark:text-slate-300 text-sm mt-1 leading-relaxed">
                    <ExpandableText text={show.summary} limit={160} className="text-slate-600 dark:text-slate-300" />
                  </div>
                </div>
              )}
              
              {(providers.length > 0 || (show.provider && show.provider !== "Unknown Provider" && show.provider !== "Unknown")) && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Streaming on</span>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {providers.length > 0 ? (
                      providers.slice(0, 4).map(p => (
                        <div key={p.provider_id} className="flex items-center gap-2">
                          <img decoding="async" loading="lazy" fetchPriority="low" src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} className="w-5 h-5 rounded" />
                          <span className="text-slate-700 dark:text-slate-300 text-base">{p.provider_name}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 text-base">{show.provider}</span>
                    )}
                  </div>
                </div>
              )}
              
              {displayGenres.length > 0 && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Genres</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {displayGenres.map(g => (
                      <span key={g} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-[11px] uppercase font-bold tracking-wider">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {displayRuntime !== null ? (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Runtime</span>
                  <p className="text-slate-700 dark:text-slate-300 text-base">{formatRuntimeMinutes(displayRuntime)}</p>
                </div>
              ) : null}

              {recommendationReason && (
                <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-3">
                  <span className="text-orange-400 text-xs font-bold uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Why this pick
                  </span>
                  <p className="text-slate-800 dark:text-slate-100 text-sm font-semibold leading-snug mt-1.5">{recommendationReason}</p>
                </div>
              )}

              {onRecommendationFeedback && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Tune recommendations</span>
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      type="button"
                      aria-pressed={recommendationFeedback === "more-like-this"}
                      onClick={() => onRecommendationFeedback("more-like-this")}
                      className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold flex items-center gap-2 ${recommendationFeedback === "more-like-this" ? "bg-orange-500 border-orange-500 text-orange-950" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"}`}
                    >
                      <ThumbsUp className="w-4 h-4" /> More like this
                    </button>
                    <button
                      type="button"
                      aria-pressed={recommendationFeedback === "not-for-me"}
                      onClick={() => onRecommendationFeedback("not-for-me")}
                      className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold flex items-center gap-2 ${recommendationFeedback === "not-for-me" ? "bg-slate-600 border-slate-500 text-white" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"}`}
                    >
                      <Ban className="w-4 h-4" /> Not for me
                    </button>
                    <button
                      type="button"
                      aria-pressed={recommendationFeedback === "already-watched"}
                      onClick={() => onRecommendationFeedback("already-watched")}
                      className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold flex items-center gap-2 ${recommendationFeedback === "already-watched" ? "bg-emerald-500 border-emerald-500 text-emerald-950" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"}`}
                    >
                      <Eye className="w-4 h-4" /> Already watched
                    </button>
                  </div>
                </div>
              )}
              
              {displayOfficialSite && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Links</span>
                  <a href={displayOfficialSite} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 text-base flex items-center gap-1 mt-1">
                    Official Site <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {inLibrary !== false ? (
                showRemoveConfirmation ? (
                  <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-3" role="alertdialog" aria-modal="true" aria-label={`Remove ${show.name}`}>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                      Remove this {show.isMovie ? "movie" : "series"} and its watch progress?
                    </p>
                    <div data-tv-row="true" className="flex gap-2">
                      <button
                        ref={cancelRemoveButtonRef}
                        type="button"
                        onClick={() => setShowRemoveConfirmation(false)}
                        disabled={isRemoving}
                        className="flex-1 py-2 px-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRemove}
                        disabled={isRemoving}
                        className="flex-1 py-2 px-3 bg-red-500 text-white rounded-lg font-bold disabled:opacity-60"
                      >
                        {isRemoving ? "Removing..." : "Yes, Remove"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirmation(true)}
                    className="w-full py-2 px-4 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors text-base font-bold flex items-center justify-center gap-2 mt-8"
                  >
                    <Trash2 className="w-4 h-4" />
                    {(show.isMovie) ? "Remove Movie" : "Remove Series"}
                  </button>
                )
              ) : (
                <div className="flex flex-col gap-2 mt-8">
                  {!(show.isMovie) && (
                    <button 
                      onClick={() => onAdd?.(true)}
                      disabled={addingShowId === show.tvmazeId}
                      className="w-full py-2 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {addingShowId === show.tvmazeId ? "Adding..." : "Caught Up"}
                    </button>
                  )}
                  <button 
                    onClick={() => onAdd?.(false)}
                    disabled={addingShowId === show.tvmazeId}
                    className="w-full py-2 px-4 bg-orange-500 text-orange-950 rounded-xl hover:bg-orange-400 transition-colors text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {addingShowId === show.tvmazeId ? "Adding..." : (show.isMovie) ? "Add Movie" : "+ Add to Library"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div data-tv-progress-panel="true" className="flex-1 flex flex-col min-w-0 md:min-h-0 bg-white/50 dark:bg-slate-900/50">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                    {show.isMovie ? "Stream Movie" : inLibrary !== false ? "Set your progress" : "Episodes"}
                  </h3>
                  {!show.isMovie && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                      {inLibrary !== false
                        ? "Choose the last episode you watched, or select a season and use the caught-up shortcut. Every earlier episode is included automatically, and the following aired episode becomes Up Next."
                        : "Browse the episode list before adding this series to your library."}
                    </p>
                  )}
                </div>
                {!show.isMovie && inLibrary !== false && (
                  <div className="shrink-0 flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950/60 px-4 py-3">
                    <div>
                      <div className="text-2xl font-display font-bold text-orange-400">{progressPercentage}%</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{watchedReleasedCount} of {releasedEpisodes.length} aired</div>
                    </div>
                    <div className="h-10 w-px bg-slate-300 dark:bg-slate-700" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Next Up</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {nextUnwatchedEpisode ? `S${nextUnwatchedEpisode.season} E${nextUnwatchedEpisode.number}` : "Caught up"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!show.isMovie && inLibrary !== false && releasedEpisodes.length > 0 && (
                <div className="w-full h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800" aria-label={`${progressPercentage}% watched`}>
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${progressPercentage}%` }} />
                </div>
              )}

              {!show.isMovie && (
                <div data-tv-row="true" className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {[{ value: "all", label: "All seasons" }, ...seasons.map(season => ({ value: String(season), label: `Season ${season}` }))].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={seasonFilter === option.value}
                      onClick={() => setSeasonFilter(option.value)}
                      className={`shrink-0 rounded-xl px-5 py-2.5 text-base font-bold border transition-colors ${
                        seasonFilter === option.value
                          ? "bg-orange-500 border-orange-500 text-orange-950"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  {inLibrary !== false && watchedReleasedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleStartFromBeginning}
                      className="shrink-0 rounded-xl px-5 py-2.5 text-base font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                    >
                      Reset series progress
                    </button>
                  )}
                  {inLibrary !== false && nextUnwatchedEpisode && releasedEpisodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetProgress(releasedEpisodes[releasedEpisodes.length - 1])}
                      className="shrink-0 rounded-xl px-5 py-2.5 text-base font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    >
                      I’m caught up
                    </button>
                  )}
                  {inLibrary !== false && seasonFilter !== "all" && releasedFilteredEpisodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetProgress(releasedFilteredEpisodes[releasedFilteredEpisodes.length - 1]);
                        setProgressNotice(`Caught up through Season ${seasonFilter}. Every earlier aired episode is marked watched, and later episodes remain unwatched.`);
                      }}
                      aria-label={`Set progress as caught up through Season ${seasonFilter}, including every earlier season`}
                      className="shrink-0 rounded-xl px-5 py-2.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex flex-col items-start leading-tight"
                    >
                      <span className="text-base font-bold">Caught up through Season {seasonFilter}</span>
                      <span className="text-xs font-medium opacity-80 mt-1">Includes every earlier season</span>
                    </button>
                  )}
                </div>
              )}

              {progressNotice && (
                <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  {progressNotice}
                </div>
              )}
            </div>
            
            <div data-tv-episode-list="true" className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
              {epsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-xl border bg-slate-100/80 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50 animate-pulse">
                    <div className="w-12 h-12 bg-slate-700/50 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                      <div className="h-3 bg-slate-700/50 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : inLibrary === false && previewEps?.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <p>Movie details unavailable.</p>
                </div>
              ) : (show.isMovie) ? (
                /* Beautiful Hero Watch Section for Movies */
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-left">
                    <h4 className="text-slate-900 dark:text-white font-display font-bold text-xl mb-1">{show.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {displayPremiered ? `Released ${new Date(displayPremiered).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}` : "Feature Film"}
                    </p>
                    {show.summary && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 leading-relaxed">
                        {show.summary.replace(/<[^>]+>/g, '')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full sm:w-auto md:w-48">
                    {(() => {
                      const finalImdbId = resolvedLocalImdb || show.imdbId;
                      const isMovieReleased = displayPremiered ? new Date(displayPremiered) <= new Date() : true;
                      
                      if (!isMovieReleased) {
                        const formattedDate = displayPremiered ? new Date(displayPremiered).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                        return (
                          <button
                            disabled
                            className="w-full py-3.5 px-6 rounded-xl bg-slate-200 dark:bg-slate-900 text-slate-400 dark:text-slate-600 flex flex-col items-center justify-center gap-1 text-sm font-semibold border border-slate-300 dark:border-slate-800"
                          >
                            <div className="flex items-center gap-2">
                              <X className="w-5 h-5" />
                              <span>Not Released Yet</span>
                            </div>
                            {formattedDate && <span className="text-[10px] opacity-75">Expected {formattedDate}</span>}
                          </button>
                        );
                      }

                      if (isCheckingImdb || !checkedImdb) {
                        return (
                          <button
                            disabled
                            className="w-full py-3.5 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2 text-base font-bold animate-pulse"
                          >
                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            <span>Locating IMDb...</span>
                          </button>
                        );
                      }

                      if (finalImdbId && finalImdbId !== "none") {
                        const movieEpisode = filteredEpisodes[0] || { id: "movie_" + show.id, season: 1, number: 1, name: show.name } as any;
                        const movieResumePosition = getResumePosition?.(show.id, movieEpisode.id) ?? null;
                        return (
                          <button
                            onClick={() => handlePlayEpisode(movieEpisode)}
                            
                            className="w-full py-3.5 px-6 rounded-xl bg-orange-500 text-orange-950 hover:bg-orange-400 active:scale-95 transition-all flex items-center justify-center gap-2 text-base font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 touch-manipulation"
                          >
                            {(false) ? (
                              <div className="w-5 h-5 border-2 border-orange-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <PlayCircle className="w-5 h-5" />
                            )}
                            <span>{movieResumePosition !== null ? `Resume ${formatPlaybackPosition(movieResumePosition)}` : "Play Movie"}</span>
                          </button>
                        );
                      } else {
                        return (
                          <button
                            disabled
                            className="w-full py-3.5 px-6 rounded-xl bg-slate-200 dark:bg-slate-900 text-slate-400 dark:text-slate-600 flex items-center justify-center gap-2 text-base font-semibold border border-slate-300 dark:border-slate-800"
                          >
                            <X className="w-5 h-5" />
                            <span>No Stream Available</span>
                          </button>
                        );
                      }
                    })()}
                    
                    {inLibrary !== false && filteredEpisodes[0] && (
                      <button 
                        onClick={() => handleToggleWatched(filteredEpisodes[0].id, filteredEpisodes[0].watched)}
                        className={`w-full py-3 px-6 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation ${
                          filteredEpisodes[0].watched 
                            ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' 
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{filteredEpisodes[0].watched ? "Watched" : "Mark Watched"}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : filteredEpisodes.map(ep => {
                const released = isEpisodeReleased(ep);
                const isNextUp = nextUnwatchedEpisode?.id === ep.id;
                const resumePosition = getResumePosition?.(show.id, ep.id) ?? null;

                return (
                  <div
                    key={ep.id}
                    data-tv-episode-row="true"
                    className={`flex flex-wrap lg:flex-nowrap items-center gap-4 p-4 rounded-2xl border ${
                      isNextUp
                        ? "bg-orange-500/10 border-orange-500/50"
                        : ep.watched
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-slate-100/80 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50"
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-mono text-sm font-extrabold shrink-0 ${
                      ep.watched ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-200 dark:bg-slate-800 text-orange-400"
                    }`}>
                      {`S${ep.season} E${ep.number}`}
                    </div>
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-slate-900 dark:text-white font-bold text-lg">{ep.name}</h4>
                        {isNextUp && <span className="rounded-md bg-orange-500 px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-orange-950">Next Up</span>}
                        {ep.watched && <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-500">Watched</span>}
                        {!released && <span className="rounded-md bg-slate-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Upcoming</span>}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {getEpisodeReleaseTime(ep) ? getEpisodeReleaseTime(ep)!.toLocaleDateString() : "Air date TBA"}
                        {ep.runtime ? ` · ${ep.runtime} min` : ""}
                      </p>
                      {ep.summary && (
                        <ExpandableText
                          text={ep.summary}
                          className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-snug break-words whitespace-normal"
                          limit={150}
                        />
                      )}
                    </div>
                    {released ? (
                      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full justify-end lg:w-auto">
                        {(() => {
                          const finalImdbId = resolvedLocalImdb || show.imdbId;

                          if (isCheckingImdb || !checkedImdb) {
                            return (
                              <button disabled className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center gap-2 text-sm font-bold animate-pulse">
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                <span>Checking...</span>
                              </button>
                            );
                          }

                          if (finalImdbId && finalImdbId !== "none") {
                            return (
                              <button
                                onClick={() => handlePlayEpisode(ep)}
                                data-tv-default-focus={isNextUp ? "true" : undefined}
                                className="px-5 py-3 rounded-xl border border-orange-500 bg-orange-500 text-orange-950 active:scale-95 touch-manipulation flex items-center gap-2 text-sm font-extrabold"
                                title={resumePosition !== null ? "Resume episode" : "Play episode"}
                              >
                                <PlayCircle className="w-5 h-5" />
                                <span>{resumePosition !== null ? `Resume ${formatPlaybackPosition(resumePosition)}` : "Play"}</span>
                              </button>
                            );
                          }

                          return (
                            <button disabled className="px-4 py-3 rounded-xl bg-slate-200/50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 flex items-center gap-2 text-sm font-semibold border border-slate-200 dark:border-slate-800">
                              <X className="w-4 h-4" />
                              <span>No Stream</span>
                            </button>
                          );
                        })()}
                        {inLibrary !== false && (
                          <button
                            type="button"
                            onClick={() => handleSetProgress(ep)}
                            aria-label={`Set ${show.name} progress through season ${ep.season}, episode ${ep.number}`}
                            className={`px-5 py-3 rounded-xl border font-bold text-sm flex items-center gap-2 active:scale-95 touch-manipulation ${
                              isNextUp
                                ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                                : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Set as last watched</span>
                          </button>
                        )}
                      </div>
                    ) : getEpisodeReleaseTime(ep) ? (
                      <div className="flex items-center gap-2 shrink-0 w-full justify-end lg:w-auto">
                        <AddToCalendarButton
                          showName={show.name}
                          season={ep.season}
                          number={ep.number}
                          epTitle={ep.name}
                          airstamp={getEpisodeReleaseTime(ep)?.toISOString() || ""}
                          runtimeMinutes={show.runtime}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {inLibrary !== false && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur shrink-0 md:hidden flex justify-center">
                <button 
                  onClick={onClose}
                  className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold text-base hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all touch-manipulation"
                >
                  Close
                </button>
              </div>
            )}
            {inLibrary === false && previewEps && previewEps.length > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur shrink-0 md:hidden flex gap-2">
                {!(show.isMovie) && (
                  <button 
                    onClick={() => onAdd?.(true)}
                    disabled={addingShowId === show.tvmazeId}
                    className="flex-1 py-2 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {addingShowId === show.tvmazeId ? "Adding..." : "Caught Up"}
                  </button>
                )}
                <button 
                  onClick={() => onAdd?.(false)}
                  disabled={addingShowId === show.tvmazeId}
                  className="flex-1 py-2 px-4 bg-orange-500 text-orange-950 rounded-xl hover:bg-orange-400 transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingShowId === show.tvmazeId ? "Adding..." : (show.isMovie) ? "Add Movie" : "+ Add"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
