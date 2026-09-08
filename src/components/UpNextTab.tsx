import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { CheckCircle2, Music2, PlayCircle } from "lucide-react";
import { UserEpisode, UserShow } from "../types";
import { getEpisodeReleaseTime } from "../lib/episodes";
import { optimizeArtworkUrl } from "../lib/images";
import { formatPlaybackPosition } from "../lib/playbackProgress";
import { formatUpNextAirDate, SmartUpNextItem } from "../lib/upNext";
import { formatCatchUpDuration } from "../lib/episodeBacklog";
import { consumeCarouselWheel, createCarouselWheelState } from "../lib/carouselWheel";
import { getAdjacentCarouselIndexes } from "../lib/carouselPreload";
import { TvThemePlayer, TvThemePlaybackStatus, TvThemePlayerHandle } from "./TvThemePlayer";

interface UpNextTabProps {
  items: SmartUpNextItem[];
  isReady: boolean;
  onPlay: (show: UserShow, episode: UserEpisode) => void;
  onFindShow: () => void;
  onWarmSource: (show: UserShow, episode: UserEpisode) => void;
  getResumePosition: (showId: string, episodeId: string) => number | null;
  themeMusicEnabled: boolean;
  memoryKey?: string;
}

export function UpNextTab({
  items,
  isReady,
  onPlay,
  onFindShow,
  onWarmSource,
  getResumePosition,
  themeMusicEnabled,
  memoryKey
}: UpNextTabProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [themeStatus, setThemeStatus] = useState<TvThemePlaybackStatus>("idle");
  const themePlayerRef = useRef<TvThemePlayerHandle>(null);
  const warmTimerRef = useRef<number | null>(null);
  const heroPlayButtonRef = useRef<HTMLButtonElement>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const carouselWheelStateRef = useRef(createCarouselWheelState());
  const carouselStageCleanupRef = useRef<(() => void) | null>(null);
  const heroArtworkPreloadsRef = useRef(new Map<string, HTMLImageElement>());
  const safeActiveIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0;
  const activeItem = items[safeActiveIndex];
  const queueSummary = useMemo(() => {
    const episodes = items.reduce((total, item) => total + item.backlog.unwatchedCount, 0);
    return `${items.length} ${items.length === 1 ? "show" : "shows"} · ${episodes} unwatched ${episodes === 1 ? "episode" : "episodes"}`;
  }, [items]);

  const railItems = useMemo(() => {
    if (items.length <= 1) return [];
    return Array.from({ length: items.length - 1 }, (_, offset) => {
      const index = (safeActiveIndex + offset + 1) % items.length;
      return { item: items[index], index };
    });
  }, [items, safeActiveIndex]);

  const adjacentHeroArtworkUrls = useMemo(() => {
    const urls = getAdjacentCarouselIndexes(safeActiveIndex, items.length)
      .map(index => items[index]?.show)
      .map(show => show ? optimizeArtworkUrl(show.backdropUrl || show.imageUrl) : "")
      .filter((url): url is string => !!url);
    return Array.from(new Set(urls));
  }, [items, safeActiveIndex]);

  useEffect(() => {
    if (!items.length) return;
    let restoredIndex = -1;
    if (memoryKey) {
      try {
        const savedItem = localStorage.getItem(`nextup_up_next_item:${memoryKey}`);
        restoredIndex = items.findIndex(item => `${item.show.id}:${item.nextEp.id}` === savedItem);
      } catch {
        // The first queue item remains the safe default when storage is unavailable.
      }
    }
    setActiveIndex(restoredIndex >= 0 ? restoredIndex : 0);
  }, [items[0]?.show.id, items[0]?.nextEp.id, items.length, memoryKey]);

  useEffect(() => {
    if (!memoryKey || !activeItem) return;
    try {
      localStorage.setItem(`nextup_up_next_item:${memoryKey}`, `${activeItem.show.id}:${activeItem.nextEp.id}`);
    } catch {
      // Queue navigation still works without persistent storage.
    }
  }, [activeItem?.show.id, activeItem?.nextEp.id, memoryKey]);

  useEffect(() => {
    thumbnailRailRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [safeActiveIndex]);

  useEffect(() => {
    if (typeof Image === "undefined") return;

    const desiredUrls = new Set(adjacentHeroArtworkUrls);
    heroArtworkPreloadsRef.current.forEach((_image, url) => {
      if (!desiredUrls.has(url)) heroArtworkPreloadsRef.current.delete(url);
    });

    desiredUrls.forEach(url => {
      if (heroArtworkPreloadsRef.current.has(url)) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.referrerPolicy = "no-referrer";
      image.src = url;
      heroArtworkPreloadsRef.current.set(url, image);
      void image.decode().catch(() => {
        // The normal hero image remains the fallback if eager decoding fails.
      });
    });
  }, [adjacentHeroArtworkUrls]);

  useEffect(() => () => {
    heroArtworkPreloadsRef.current.clear();
  }, []);

  useEffect(() => {
    if (warmTimerRef.current !== null) window.clearTimeout(warmTimerRef.current);
    if (!activeItem) return;

    warmTimerRef.current = window.setTimeout(() => {
      onWarmSource(activeItem.show, activeItem.nextEp);
      warmTimerRef.current = null;
    }, 1_000);

    return () => {
      if (warmTimerRef.current !== null) {
        window.clearTimeout(warmTimerRef.current);
        warmTimerRef.current = null;
      }
    };
  }, [activeItem?.show.id, activeItem?.nextEp.id, onWarmSource]);

  const stepCarousel = useCallback((direction: -1 | 1) => {
    if (items.length <= 1) return;
    setActiveIndex(current => (current + direction + items.length) % items.length);
  }, [items.length]);

  const bindCarouselStage = useCallback((carouselStage: HTMLDivElement | null) => {
    carouselStageCleanupRef.current?.();
    carouselStageCleanupRef.current = null;
    carouselWheelStateRef.current = createCarouselWheelState();
    if (!carouselStage || items.length <= 1) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaX === 0 && event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();

      const result = consumeCarouselWheel(
        carouselWheelStateRef.current,
        event.deltaX,
        event.deltaY,
        performance.now()
      );
      carouselWheelStateRef.current = result.state;
      if (result.direction === null) return;

      heroPlayButtonRef.current?.focus({ preventScroll: true });
      stepCarousel(result.direction);
    };

    carouselStage.addEventListener("wheel", handleWheel, { passive: false });
    carouselStageCleanupRef.current = () => carouselStage.removeEventListener("wheel", handleWheel);
  }, [items.length, stepCarousel]);

  const handleHeroKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const keyCode = event.keyCode || event.which;
    if (event.key === "ArrowLeft" || keyCode === 37) {
      event.preventDefault();
      stepCarousel(-1);
    } else if (event.key === "ArrowRight" || keyCode === 39) {
      event.preventDefault();
      stepCarousel(1);
    }
  };

  const activateFromThumbnail = (index: number) => {
    setActiveIndex(index);
    window.requestAnimationFrame(() => heroPlayButtonRef.current?.focus({ preventScroll: true }));
  };

  const handleThumbnailClick = (item: SmartUpNextItem, index: number) => {
    const touchFirst = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
    if (touchFirst || window.matchMedia("(max-width: 767px)").matches) {
      onPlay(item.show, item.nextEp);
      return;
    }
    activateFromThumbnail(index);
  };

  return (
    <section data-tv-up-next-screen="true" data-tv-adjacent-artwork-preload="true" className="tv-up-next-dashboard relative flex flex-col gap-3">
      <TvThemePlayer
        ref={themePlayerRef}
        show={activeItem?.show}
        enabled={themeMusicEnabled}
        onStatusChange={setThemeStatus}
      />
      <div className="tv-up-next-heading flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">Next Up</h2>
        {items.length > 0 && <p className="order-3 w-full sm:order-none sm:w-auto truncate text-slate-600 dark:text-slate-400 text-sm sm:text-base">{queueSummary}</p>}
        {themeStatus === "blocked" && themeMusicEnabled && (
          <button
            type="button"
            onClick={() => themePlayerRef.current?.play()}
            className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-orange-400/35 bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-300 active:scale-95"
            aria-label="Play this show's theme music"
          >
            <Music2 className="h-4 w-4" />
            Play theme
          </button>
        )}
        {themeStatus === "playing" && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full border border-orange-400/25 bg-black/45 p-2 text-orange-200" aria-label="Theme playing">
            <Music2 className="h-4 w-4" />
          </span>
        )}
      </div>

      {items.length === 0 && isReady ? (
        <div data-tv-section="up-next-empty" className="flex-1 min-h-[420px] bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-5" />
          <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">You're all caught up</h3>
          <p className="text-slate-600 dark:text-slate-400 text-base mb-6">Add something new or check back after another episode airs.</p>
          <button data-tv-default-focus="true" onClick={onFindShow} className="bg-orange-500 text-orange-950 font-bold px-8 py-3 rounded-2xl hover:bg-orange-400 transition-colors">
            Find something to watch
          </button>
        </div>
      ) : activeItem ? (() => {
        const { show, nextEp, queueReason, backlog } = activeItem;
        const resumePosition = getResumePosition(show.id, nextEp.id);
        const releaseTime = getEpisodeReleaseTime(nextEp);
        const episodeLabel = show.isMovie
          ? "Feature Film"
          : `Season ${nextEp.season}, Episode ${nextEp.number} · ${nextEp.name}`;
        const visibleThumbnailCount = railItems.length > 3
          ? 3.35
          : Math.max(1, railItems.length);
        const thumbnailGap = 24;
        const visibleGapCount = Math.max(0, Math.ceil(visibleThumbnailCount) - 1);
        const thumbnailBasis = `calc((100% - ${visibleGapCount * thumbnailGap}px) / ${visibleThumbnailCount})`;

        return (
          <div
            ref={bindCarouselStage}
            data-tv-section="up-next-stage"
            data-tv-up-next-stage="true"
            data-tv-synced-wheel-carousel="true"
            className="flex flex-col md:flex-row flex-1 min-h-0 md:min-h-[470px] gap-4 md:gap-5 overflow-visible md:overflow-hidden select-none"
          >
            <article
              data-tv-card="true"
              data-tv-up-next-hero="true"
              className="relative shrink-0 w-full md:w-[46%] min-h-[410px] sm:min-h-[420px] rounded-3xl md:rounded-[2rem] overflow-hidden bg-slate-950 border border-slate-700 shadow-xl"
            >
              <button
                ref={heroPlayButtonRef}
                id="up-next-hero-play"
                type="button"
                data-tv-default-focus="true"
                data-tv-horizontal-handler="true"
                data-tv-wheel-carousel="true"
                data-tv-down="#tv-nav-up-next"
                data-tv-focus-key={`up-next:${show.id}:${nextEp.id}`}
                className="absolute inset-0 z-30 rounded-[2rem]"
                aria-label={`${resumePosition !== null ? `Resume from ${formatPlaybackPosition(resumePosition)}` : "Play"} ${show.name}, ${episodeLabel}`}
                onKeyDown={handleHeroKeyDown}
                onClick={() => onPlay(show, nextEp)}
              />

              <div key={`${show.id}:${nextEp.id}`} data-tv-up-next-hero-content="true" className="absolute inset-0">
                {show.imageUrl ? (
                  <img
                    decoding="async"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    fetchPriority="high"
                    src={optimizeArtworkUrl(show.backdropUrl || show.imageUrl)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-90 pointer-events-none"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-slate-700 pointer-events-none">{show.name?.[0] || "?"}</div>
                )}

                <div data-tv-hero-side-gradient="true" className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/10 pointer-events-none" />
                <div data-tv-hero-floor-gradient="true" className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent pointer-events-none" />
                <div data-tv-up-next-hero-copy="true" className="relative z-10 h-full p-5 sm:p-7 md:p-9 flex flex-col justify-end max-w-full sm:max-w-[88%] pointer-events-none">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span data-tv-hero-eyebrow="true" className="px-3 py-1.5 rounded-lg bg-orange-500 text-orange-950 text-xs font-extrabold uppercase tracking-wider">{queueReason}</span>
                  </div>

                  <h3 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white leading-none tracking-tight mb-3 drop-shadow-lg line-clamp-2">
                    {show.name}
                  </h3>
                  <p className="text-lg md:text-xl font-semibold text-slate-100 mb-4 drop-shadow line-clamp-2">
                    {episodeLabel}
                  </p>

                  <div data-tv-hero-meta="true" className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-300 mb-4">
                    {releaseTime && <span>{formatUpNextAirDate(releaseTime)}</span>}
                    {(nextEp.runtime || show.runtime) && <span>{nextEp.runtime || show.runtime} min</span>}
                    {backlog.unwatchedCount > 1 && backlog.remainingMinutes > 0 && (
                      <span>{formatCatchUpDuration(backlog.remainingMinutes)} to catch up</span>
                    )}
                  </div>

                  <div className="flex items-center">
                    <span data-tv-hero-action="true" className="inline-flex w-full sm:w-fit max-w-full min-h-[52px] sm:min-w-[170px] px-5 md:px-7 py-3.5 bg-orange-500 text-orange-950 text-lg font-extrabold rounded-2xl items-center justify-center gap-3 whitespace-nowrap">
                      <PlayCircle className="w-7 h-7" />
                      {resumePosition !== null ? `Resume ${formatPlaybackPosition(resumePosition)}` : "Play"}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {railItems.length > 0 && (
              <div className="flex flex-1 min-w-0 flex-col gap-2 sm:gap-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">More from your queue</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 md:hidden">Tap any card to play it</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{railItems.length} more</span>
                </div>
                <div
                  ref={thumbnailRailRef}
                  data-tv-up-next-rail="true"
                  data-tv-synced-carousel-rail="true"
                  className="flex flex-1 min-w-0 items-start gap-3 sm:gap-5 overflow-x-auto md:overflow-hidden snap-x snap-mandatory pb-2 scrollbar-none"
                >
                  {railItems.map(({ item, index }) => {
                  const thumbnailEpisodeLabel = item.show.isMovie
                    ? "Feature Film"
                    : `S${item.nextEp.season} E${item.nextEp.number}`;
                  return (
                    <button
                      key={`${item.show.id}:${item.nextEp.id}`}
                      type="button"
                      tabIndex={-1}
                      data-tv-ignore="true"
                      data-tv-up-next-thumbnail="true"
                      data-tv-poster-card="true"
                      data-phone-up-next-thumbnail="true"
                      onClick={() => handleThumbnailClick(item, index)}
                      aria-label={`Play ${item.show.name}, ${thumbnailEpisodeLabel}`}
                      className="relative shrink-0 min-h-[220px] sm:min-h-[280px] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 text-left active:scale-[0.98] snap-start shadow-lg"
                      style={{ "--phone-thumbnail-basis": thumbnailBasis } as React.CSSProperties}
                    >
                      {item.show.imageUrl ? (
                        <img
                          decoding="async"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          fetchPriority="low"
                          src={optimizeArtworkUrl(item.show.backdropUrl || item.show.imageUrl)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover object-center opacity-90 pointer-events-none"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-slate-700 pointer-events-none">{item.show.name?.[0] || "?"}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent pointer-events-none" />
                      <span className="absolute top-3 right-3 z-20 w-11 h-11 rounded-full bg-orange-500 text-orange-950 shadow-lg flex items-center justify-center pointer-events-none md:hidden">
                        <PlayCircle className="w-6 h-6" />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 pointer-events-none">
                        <span className="inline-flex mb-2 px-2.5 py-1 rounded-md bg-black/65 border border-white/10 text-orange-300 text-[11px] font-bold uppercase tracking-wider">
                          {item.queueReason}
                        </span>
                        <h4 className="text-white text-xl font-display font-bold leading-tight line-clamp-2">{item.show.name}</h4>
                        <p className="text-slate-300 text-sm font-semibold mt-1">{thumbnailEpisodeLabel}</p>
                        {item.backlog.unwatchedCount > 1 && (
                          <p className="text-orange-200 text-xs font-bold mt-1">{item.backlog.unwatchedCount} episodes waiting</p>
                        )}
                      </div>
                    </button>
                  );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })() : (
        <div className="flex-1 min-h-[320px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 flex items-center justify-center" role="status">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-300 text-base font-semibold">Building your queue...</p>
          </div>
        </div>
      )}
    </section>
  );
}
