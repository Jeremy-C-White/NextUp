import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, TouchEvent as ReactTouchEvent } from "react";
import { CheckCircle2, Music2, PlayCircle } from "lucide-react";
import { UserEpisode, UserShow } from "../types";
import { getEpisodeReleaseTime } from "../lib/episodes";
import { optimizeArtworkUrl } from "../lib/images";
import { formatPlaybackPosition } from "../lib/playbackProgress";
import { formatUpNextAirDate, SmartUpNextItem } from "../lib/upNext";
import { formatCatchUpDuration } from "../lib/episodeBacklog";
import { consumeCarouselWheel, createCarouselWheelState, getCarouselPreviewIndex, getCarouselSwipeDirection } from "../lib/carouselWheel";
import { getAdjacentCarouselIndexes } from "../lib/carouselPreload";
import { HeroTitle, useTitleLogo } from "./HeroTitle";
import { prefetchTitleLogos } from "../lib/titleLogos";
import { setAmbientArtwork } from "../lib/ambientArtwork";
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

interface PhoneUpNextFanCardProps {
  item: SmartUpNextItem;
  index: number;
  side: "previous" | "next";
  dragOffset: number;
  isDragging: boolean;
}

function PhoneUpNextFanCard({ item, index, side, dragOffset, isDragging }: PhoneUpNextFanCardProps) {
  const logo = useTitleLogo(item.show);
  const artworkUrl = optimizeArtworkUrl(item.show.backdropUrl || item.show.imageUrl);
  const isRevealed = side === "previous" ? dragOffset > 0 : dragOffset < 0;
  const revealProgress = isRevealed ? Math.min(1, Math.abs(dragOffset) / 240) : 0;
  const direction = side === "previous" ? -1 : 1;
  const episodeLabel = item.show.isMovie
    ? "Feature Film"
    : `Season ${item.nextEp.season}, Episode ${item.nextEp.number} · ${item.nextEp.name}`;

  return (
    <div
      data-phone-up-next-fan-card={side}
      data-phone-up-next-fan-index={index}
      data-phone-up-next-fan-revealed={isRevealed ? "true" : "false"}
      aria-hidden="true"
      className="absolute overflow-hidden rounded-3xl border border-white/25 bg-[#050811] shadow-2xl md:hidden"
      style={{
        zIndex: isRevealed ? 2 : 1,
        transform: `translate3d(${direction * 7.2 * (1 - revealProgress)}px, ${5.6 - 3.2 * revealProgress}px, 0) rotate(${direction * 2.75 * (1 - revealProgress)}deg) scale(${0.97 + 0.025 * revealProgress})`,
        transition: isDragging
          ? "border-color 180ms ease, box-shadow 220ms ease, filter 180ms ease"
          : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms ease, box-shadow 280ms ease, filter 220ms ease"
      }}
    >
      {artworkUrl ? (
        <img
          decoding="async"
          referrerPolicy="no-referrer"
          loading="eager"
          fetchPriority="low"
          src={artworkUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-6xl font-bold text-slate-700">
          {item.show.name?.[0] || "?"}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/72 to-slate-950/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/28 to-transparent" />
      <div data-phone-up-next-fan-copy="true" className="absolute inset-x-0 bottom-0 z-10 p-5 pointer-events-none">
        <span className="mb-3 inline-flex rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-orange-950">
          {item.queueReason}
        </span>
        <HeroTitle
          name={item.show.name}
          logo={logo}
          headingClassName="mb-2 line-clamp-2 text-3xl font-display font-bold leading-none tracking-tight text-white drop-shadow-lg"
        />
        <p className="line-clamp-2 text-base font-semibold text-slate-100 drop-shadow">{episodeLabel}</p>
      </div>
    </div>
  );
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
  const heroTouchStartRef = useRef<{ x: number; y: number; lastX: number; lastY: number; startedAt: number } | null>(null);
  const heroDragOffsetRef = useRef(0);
  const blockHeroClickRef = useRef(false);
  const swipeCommitTimerRef = useRef<number | null>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const carouselWheelStateRef = useRef(createCarouselWheelState());
  const carouselStageCleanupRef = useRef<(() => void) | null>(null);
  const heroArtworkPreloadsRef = useRef(new Map<string, HTMLImageElement>());
  const [heroDragOffset, setHeroDragOffset] = useState(0);
  const [heroIsDragging, setHeroIsDragging] = useState(false);
  const [heroTransitionDirection, setHeroTransitionDirection] = useState<-1 | 0 | 1>(0);
  const safeActiveIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0;
  const activeItem = items[safeActiveIndex];
  const activeTitleLogo = useTitleLogo(activeItem?.show);
  const heroRevealProgress = Math.min(1, Math.abs(heroDragOffset) / 240);
  const ambientPreviewIndex = getCarouselPreviewIndex(safeActiveIndex, items.length, heroDragOffset);
  const queueSummary = useMemo(() => {
    const episodes = items.reduce((total, item) => total + item.backlog.unwatchedCount, 0);
    return `${items.length} ${items.length === 1 ? "show" : "shows"} \u00b7 ${episodes} unwatched ${episodes === 1 ? "episode" : "episodes"}`;
  }, [items]);

  const railItems = useMemo(() => {
    if (items.length <= 1) return [];
    return Array.from({ length: items.length - 1 }, (_, offset) => {
      const index = (safeActiveIndex + offset + 1) % items.length;
      return { item: items[index], index };
    });
  }, [items, safeActiveIndex]);

  const fanItems = useMemo(() => {
    if (items.length <= 1) return [];
    const offsets = items.length === 2 ? [1] : [-1, 1];
    return offsets.map(offset => {
      const index = (safeActiveIndex + offset + items.length) % items.length;
      return {
        item: items[index],
        index,
        side: offset < 0 ? "previous" as const : "next" as const
      };
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
    if (swipeCommitTimerRef.current !== null) window.clearTimeout(swipeCommitTimerRef.current);
    setAmbientArtwork(null);
  }, []);

  useEffect(() => {
    const ambientItem = items[ambientPreviewIndex];
    if (!ambientItem) {
      setAmbientArtwork(null);
      return;
    }
    const artwork = optimizeArtworkUrl(ambientItem.show.backdropUrl || ambientItem.show.imageUrl);
    const isSwipePreview = ambientPreviewIndex !== safeActiveIndex;
    const timer = window.setTimeout(() => setAmbientArtwork(artwork || null), isSwipePreview ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [ambientPreviewIndex, safeActiveIndex, items[ambientPreviewIndex]?.show.id, items[ambientPreviewIndex]?.show.backdropUrl, items[ambientPreviewIndex]?.show.imageUrl]);

  const logoPrefetchKey = items.map(item => item.show.id).join("|");
  useEffect(() => {
    if (!items.length) return;
    const controller = new AbortController();
    const prioritized = [
      ...getAdjacentCarouselIndexes(safeActiveIndex, items.length).map(index => items[index]),
      ...items
    ]
      .filter((item, index, all) => item && all.findIndex(other => other.show.id === item.show.id) === index)
      .map(item => item.show);
    const timer = window.setTimeout(() => {
      void prefetchTitleLogos(prioritized, controller.signal);
    }, 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [logoPrefetchKey, safeActiveIndex]);

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
    setHeroTransitionDirection(direction);
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

  const handleHeroTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    if (!touch || items.length <= 1) return;
    if (swipeCommitTimerRef.current !== null) {
      window.clearTimeout(swipeCommitTimerRef.current);
      swipeCommitTimerRef.current = null;
    }
    heroTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAt: event.timeStamp
    };
    heroDragOffsetRef.current = 0;
    blockHeroClickRef.current = false;
    setHeroIsDragging(true);
    setHeroTransitionDirection(0);
    setHeroDragOffset(0);
  };

  const handleHeroTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = heroTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    start.lastX = touch.clientX;
    start.lastY = touch.clientY;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      if (heroDragOffsetRef.current !== 0) {
        heroDragOffsetRef.current = 0;
        setHeroDragOffset(0);
      }
      return;
    }
    if (Math.abs(deltaX) < 6) return;

    if (event.cancelable) event.preventDefault();
    const maximumDrag = Math.max(72, window.innerWidth * 0.28);
    const offset = Math.max(-maximumDrag, Math.min(maximumDrag, deltaX));
    heroDragOffsetRef.current = offset;
    setHeroDragOffset(offset);
  };

  const finishHeroTouch = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = heroTouchStartRef.current;
    if (!start) return;
    const endTouch = event.changedTouches[0];
    const deltaX = (endTouch?.clientX ?? start.lastX) - start.x;
    const deltaY = (endTouch?.clientY ?? start.lastY) - start.y;
    const elapsedMs = Math.max(1, event.timeStamp - start.startedAt);
    heroTouchStartRef.current = null;

    const direction = getCarouselSwipeDirection(deltaX, deltaY, 48, elapsedMs);
    if (direction === null) {
      heroDragOffsetRef.current = 0;
      setHeroIsDragging(false);
      setHeroDragOffset(0);
      return;
    }

    blockHeroClickRef.current = true;
    setHeroIsDragging(false);
    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      heroDragOffsetRef.current = 0;
      setHeroDragOffset(0);
      stepCarousel(direction);
      window.setTimeout(() => {
        blockHeroClickRef.current = false;
      }, 0);
      return;
    }
    const exitOffset = (direction === 1 ? -1 : 1) * Math.max(280, window.innerWidth * 0.78);
    heroDragOffsetRef.current = exitOffset;
    setHeroDragOffset(exitOffset);
    swipeCommitTimerRef.current = window.setTimeout(() => {
      swipeCommitTimerRef.current = null;
      heroDragOffsetRef.current = 0;
      setHeroDragOffset(0);
      stepCarousel(direction);
      window.setTimeout(() => {
        blockHeroClickRef.current = false;
      }, 350);
    }, 180);
  };

  const cancelHeroTouch = () => {
    heroTouchStartRef.current = null;
    heroDragOffsetRef.current = 0;
    setHeroIsDragging(false);
    setHeroDragOffset(0);
  };

  const handleHeroPlay = () => {
    if (blockHeroClickRef.current) {
      blockHeroClickRef.current = false;
      return;
    }
    if (!activeItem) return;
    onPlay(activeItem.show, activeItem.nextEp);
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
        {items.length > 0 && <p className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400 text-sm sm:text-base">{queueSummary}</p>}
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
          : `Season ${nextEp.season}, Episode ${nextEp.number} \u00b7 ${nextEp.name}`;
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
              data-phone-up-next-stack="true"
              className="relative shrink-0 w-full md:w-[46%] min-h-[410px] sm:min-h-[420px] rounded-3xl md:rounded-[2rem] overflow-visible md:overflow-hidden bg-transparent md:bg-slate-950 border border-transparent md:border-slate-700 shadow-none md:shadow-xl"
            >
              {fanItems.map(({ item, index, side }) => (
                <PhoneUpNextFanCard
                  key={`fan:${side}:${item.show.id}:${item.nextEp.id}`}
                  item={item}
                  index={index}
                  side={side}
                  dragOffset={heroDragOffset}
                  isDragging={heroIsDragging}
                />
              ))}

              <button
                ref={heroPlayButtonRef}
                id="up-next-hero-play"
                type="button"
                data-tv-default-focus="true"
                data-tv-horizontal-handler="true"
                data-tv-wheel-carousel="true"
                data-tv-down="#tv-nav-up-next"
                data-tv-focus-key={`up-next:${show.id}:${nextEp.id}`}
                className="absolute inset-0 z-30 rounded-[2rem] touch-pan-y"
                aria-label={`${resumePosition !== null ? `Resume from ${formatPlaybackPosition(resumePosition)}` : "Play"} ${show.name}, ${episodeLabel}`}
                aria-describedby={items.length > 1 ? "up-next-swipe-hint" : undefined}
                onKeyDown={handleHeroKeyDown}
                onTouchStart={handleHeroTouchStart}
                onTouchMove={handleHeroTouchMove}
                onTouchEnd={finishHeroTouch}
                onTouchCancel={cancelHeroTouch}
                onClick={handleHeroPlay}
              />

              <div
                key={`${show.id}:${nextEp.id}`}
                data-tv-up-next-hero-content="true"
                data-phone-hero-swipe={heroTransitionDirection === 1 ? "next" : heroTransitionDirection === -1 ? "previous" : undefined}
                className={`absolute inset-0 z-10 overflow-hidden rounded-3xl md:rounded-[2rem] border border-slate-700 bg-slate-950 shadow-xl md:border-0 md:shadow-none will-change-transform ${heroIsDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
                style={heroDragOffset !== 0 ? {
                  transform: `translate3d(${heroDragOffset}px, 0, 0) rotate(${heroDragOffset / Math.max(window.innerWidth, 1) * 4}deg) scale(${0.995 - heroRevealProgress * 0.008})`
                } : undefined}
                onAnimationEnd={() => setHeroTransitionDirection(0)}
              >
                {show.backdropUrl || show.imageUrl ? (
                  <img
                    decoding="async"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    fetchPriority="high"
                    src={optimizeArtworkUrl(show.backdropUrl || show.imageUrl)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-slate-700 pointer-events-none">{show.name?.[0] || "?"}</div>
                )}

                <div data-tv-hero-side-gradient="true" className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/10 pointer-events-none" />
                <div data-tv-hero-floor-gradient="true" className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent pointer-events-none" />
                {items.length > 1 && (
                  <span className="absolute top-4 right-4 z-20 rounded-full bg-black/60 border border-white/10 px-3 py-1.5 text-xs font-bold text-white/85 pointer-events-none">
                    {safeActiveIndex + 1} / {items.length}
                  </span>
                )}
                <div data-tv-up-next-hero-copy="true" className="relative z-10 h-full p-5 sm:p-7 md:p-9 flex flex-col justify-end max-w-full sm:max-w-[88%] pointer-events-none">
                  <div data-phone-card-settle="eyebrow" className="flex flex-wrap items-center gap-3 mb-3">
                    <span data-tv-hero-eyebrow="true" className="px-3 py-1.5 rounded-lg bg-orange-500 text-orange-950 text-xs font-extrabold uppercase tracking-wider">{queueReason}</span>
                  </div>

                  <div data-phone-card-settle="title">
                    <HeroTitle
                      name={show.name}
                      logo={activeTitleLogo}
                      headingClassName="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white leading-none tracking-tight mb-3 drop-shadow-lg line-clamp-2"
                    />
                  </div>
                  <p data-phone-card-settle="episode" className="text-lg md:text-xl font-semibold text-slate-100 mb-4 drop-shadow line-clamp-2">
                    {episodeLabel}
                  </p>

                  <div data-tv-hero-meta="true" data-phone-card-settle="meta" className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-300 mb-4">
                    {releaseTime && <span>{formatUpNextAirDate(releaseTime)}</span>}
                    {(nextEp.runtime || show.runtime) && <span>{nextEp.runtime || show.runtime} min</span>}
                    {backlog.unwatchedCount > 1 && backlog.remainingMinutes > 0 && (
                      <span>{formatCatchUpDuration(backlog.remainingMinutes)} to catch up</span>
                    )}
                  </div>

                  <div data-phone-card-settle="action" className="flex items-center">
                    <span data-tv-hero-action="true" className="inline-flex w-full sm:w-fit max-w-full min-h-[52px] sm:min-w-[170px] px-5 md:px-7 py-3.5 bg-orange-500 text-orange-950 text-lg font-extrabold rounded-2xl items-center justify-center gap-3 whitespace-nowrap">
                      <PlayCircle className="w-7 h-7" />
                      {resumePosition !== null ? `Resume ${formatPlaybackPosition(resumePosition)}` : "Play"}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {items.length > 1 && (
              <div id="up-next-swipe-hint" className="md:hidden -mt-1 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span aria-hidden="true" className="text-base text-orange-400">‹</span>
                <span>Flick left or right</span>
                <span aria-hidden="true" className="text-base text-orange-400">›</span>
              </div>
            )}

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
