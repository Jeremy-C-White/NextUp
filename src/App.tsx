import { useCallback, useEffect, useState, lazy, Suspense, useMemo, useRef } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { LibraryTab } from "./components/LibraryTab";
import { UpNextTab } from "./components/UpNextTab";
import { collection, onSnapshot, query, getDocs, writeBatch, setDoc, doc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ExpandableText } from "./components/ExpandableText";
import { SwipeableCard } from "./components/SwipeableCard";

const AuthScreen = lazy(() => import("./components/AuthScreen").then(m => ({ default: m.AuthScreen })));
const OnboardingScreen = lazy(() => import("./components/OnboardingScreen").then(m => ({ default: m.OnboardingScreen })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(m => ({ default: m.SettingsModal })));
const SearchModal = lazy(() => import("./components/SearchModal").then(m => ({ default: m.SearchModal })));
const DetailsModal = lazy(() => import("./components/DetailsModal").then(m => ({ default: m.DetailsModal })));
const VideoPlayerModal = lazy(() => import("./components/VideoPlayerModal").then(m => ({ default: m.VideoPlayerModal })));
const RecommendationModal = lazy(() => import("./components/RecommendationModal").then(m => ({ default: m.RecommendationModal })));

import { UserMenu } from "./components/UserMenu";
import { DiscoverErrorBoundary } from "./components/DiscoverErrorBoundary";
import { ResumePlaybackDialog } from "./components/ResumePlaybackDialog";
import { AmbientBackdrop } from "./components/AmbientBackdrop";
import { ComingTab } from "./components/ComingTab";
import { buildComingSchedule } from "./lib/comingSchedule";
import { LibraryFilter, normalizeLibraryFilter } from "./lib/libraryShelves";
import { UserShow, Show, UserEpisode, PlaybackRequest } from "./types";
import { addShowToLibrary, getShowEpisodes, markEpisodeWatched, markEpisodesWatchedBatch, removeShowFromLibrary, removeUndefined, restoreShowToLibrary, setEpisodeProgress } from "./lib/library";
import { getLibraryDocumentIds } from "./lib/libraryIdentity";
import { checkAndNotifyUpcomingEpisodes } from "./lib/notifications";
import { getTrendingShows, getPremieringSoon, resolveTVMazeShow, getShow, getTrendingTVMaze, getHiddenGems, getForYou } from "./lib/tvmaze";
import { getTrendingTMDB, getTrendingMoviesTMDB, getRecommendationsTMDB, getTMDBIdFromIMDB, getTopShowsByNetwork, getHiddenGemsTMDB, getForYouTMDB, getTMDBExternalIds } from "./lib/tmdb";
import { getBestAioStreamsSources, warmAioStreamsConnection } from "./lib/debrid";
import { Tv, Search, LogOut, Settings, CheckCircle2, PlayCircle, Clock, ExternalLink, Compass, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { calculateProgress, isEpisodeReleased, getEpisodeReleaseTime, getReleasedEpisodes } from "./lib/episodes";
import { format } from "date-fns";
import { registerSW } from "virtual:pwa-register";
import { isTvBackKey, isWebOSTV, platformBack } from "./lib/webos";
import { optimizeArtworkUrl } from "./lib/images";
import { findNextReleasedEpisode } from "./lib/autoplay";
import { rankUpNextItems } from "./lib/upNext";
import { buildEpisodeBacklog } from "./lib/episodeBacklog";
import { buildEpisodeProgressSelection } from "./lib/episodeProgress";
import { preserveLatestEpisodeWatchState } from "./lib/episodeReconciliation";
import { buildPlaybackPercentageIndex, clearPlaybackProgress, getResumePosition, readPlaybackProgress } from "./lib/playbackProgress";
import { resolveBackAction, shouldIgnoreBackPress } from "./lib/backNavigation";
import {
  applyRecommendationFeedback,
  EMPTY_RECOMMENDATION_PROFILE,
  getRecommendationCandidateKey,
  getRecommendationReason,
  isRecommendationCandidateInLibrary,
  rankRecommendationCandidates,
  readRecommendationProfile,
  writeRecommendationProfile
} from "./lib/recommendationPreferences";
import type { RecommendationFeedbackKind, RecommendationProfile, RecommendationSource } from "./lib/recommendationPreferences";
import { parseLibraryShowRecord } from "./lib/libraryData";
import { readThemeMusicEnabled, saveThemeMusicEnabled } from "./lib/tvThemes";
import { readAutoSkipEnabled, saveAutoSkipEnabled } from "./lib/autoSkip";

interface PendingPlaybackChoice {
  request: PlaybackRequest;
  resumePosition: number;
}

type AppTab = "up-next" | "discover" | "coming" | "library";
const APP_TABS: AppTab[] = ["up-next", "discover", "coming", "library"];

function readSavedAppTab(): AppTab {
  try {
    const savedTab = localStorage.getItem("nextup_active_tab");
    return APP_TABS.includes(savedTab as AppTab) ? savedTab as AppTab : "up-next";
  } catch {
    return "up-next";
  }
}

function readStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function ModalLoadingFallback() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
      tabIndex={0}
      data-tv-default-focus="true"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );
}

function createPlaybackRequest(show: UserShow, episode: UserEpisode): PlaybackRequest {
  return {
    showId: show.id,
    showName: show.name,
    isMovie: show.isMovie,
    imdbId: show.imdbId && show.imdbId !== "none" ? show.imdbId : undefined,
    _tmdbId: show._tmdbId,
    tvmazeId: show.tvmazeId,
    episodeId: episode.id,
    season: episode.season,
    number: episode.number,
    episodeName: episode.name,
    imageUrl: show.imageUrl,
    backdropUrl: show.backdropUrl,
    episodeImageUrl: episode.imageUrl,
    summary: episode.summary || show.summary,
    provider: show.provider
  };
}

function ScrollRow({ children, storageKey }: { children: ReactNode; storageKey?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ down: false, moved: false, startX: 0, startLeft: 0 });
  const arrowsRef = useRef({ left: false, right: false });
  const scrollFrameRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    if (left !== arrowsRef.current.left) setCanLeft(left);
    if (right !== arrowsRef.current.right) setCanRight(right);
    arrowsRef.current = { left, right };
  };

  const scheduleArrowUpdate = () => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateArrows();
    });
  };

  useEffect(() => {
    if (storageKey) {
      try {
        const savedPosition = Number(localStorage.getItem(`nextup_row_scroll:${storageKey}`));
        if (Number.isFinite(savedPosition) && savedPosition > 0 && trackRef.current) {
          trackRef.current.scrollLeft = savedPosition;
        }
      } catch {
        // The row remains usable when private storage is unavailable.
      }
    }
    updateArrows();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(scheduleArrowUpdate);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
      if (storageKey && trackRef.current) {
        try {
          localStorage.setItem(`nextup_row_scroll:${storageKey}`, String(Math.round(trackRef.current.scrollLeft)));
        } catch {
          // Scroll restoration is optional polish.
        }
      }
    };
  }, [storageKey]);

  const handleScroll = () => {
    scheduleArrowUpdate();
    if (!storageKey || !trackRef.current) return;
    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      if (!trackRef.current) return;
      try {
        localStorage.setItem(`nextup_row_scroll:${storageKey}`, String(Math.round(trackRef.current.scrollLeft)));
      } catch {
        // Scroll restoration is optional polish.
      }
    }, 180);
  };

  const scrollByDir = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "auto" });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // Mouse drag-to-scroll only; touch already scrolls natively
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    dragRef.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    const el = trackRef.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) el.scrollLeft = d.startLeft - dx;
  };

  const endDrag = () => {
    // Keep `moved` true briefly so the click-capture below can swallow the click
    // browsers synthesize after pointerup.
    const moved = dragRef.current.moved;
    dragRef.current.down = false;
    if (moved) {
      window.setTimeout(() => { dragRef.current.moved = false; }, 120);
    }
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="relative group/row"
      data-tv-edge-rail-shell="true"
      data-tv-rail-has-next={canRight ? "true" : "false"}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        data-tv-row="true"
        data-tv-edge-rail-track="true"
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-proximity cursor-grab active:cursor-grabbing select-none"
      >
        {children}
      </div>
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          data-tv-ignore="true"
          tabIndex={-1}
          onClick={() => scrollByDir(-1)}
          className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          data-tv-ignore="true"
          tabIndex={-1}
          onClick={() => scrollByDir(1)}
          className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-30 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  
  const [playbackRequest, setPlaybackRequest] = useState<PlaybackRequest | null>(null);
  const [pendingPlaybackChoice, setPendingPlaybackChoice] = useState<PendingPlaybackChoice | null>(null);
  const [playerBackRequest, setPlayerBackRequest] = useState(0);
  const [playbackProgressRevision, setPlaybackProgressRevision] = useState(0);
  const [timelineRevision, setTimelineRevision] = useState(0);
  const [toast, setToast] = useState<{message: string, action?: {label: string, onClick: () => void | Promise<void>}} | null>(null);

  useEffect(() => {
    if (user) {
      const unsubscribe = fetchLibrary();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.action ? 7000 : 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (isWebOSTV()) return;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setToast({
          message: 'Update available',
          action: {
            label: 'Refresh',
            onClick: () => updateSW(true)
          }
        });
      },
      onOfflineReady() {
        setToast({ message: 'Ready to work offline' });
      },
      onRegisterError(error) {
        console.error("Service worker registration failed", error);
      }
    });
  }, []);
const STREAMING_NETWORKS = [
  { id: 213, name: "Netflix" },
  { id: 2552, name: "Apple TV+" },
  { id: 1024, name: "Amazon Prime Video" },
  { id: 2739, name: "Disney+" },
  { id: 4330, name: "Paramount+" },
  { id: 3186, name: "Max" },
  { id: 453, name: "Hulu" }
];

function normalizeDiscoverShows(value: unknown): Show[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((show): show is Show => {
    if (!show || typeof show !== "object") {
      return false;
    }
    const candidate = show as Partial<Show>;
    return (
      typeof candidate.id === "number" &&
      typeof candidate.name === "string" &&
      candidate.name.trim().length > 0
    );
  });
}

function getDisplayRating(show: Show): string | null {
  const rawRating = show.rating?.average ?? show.vote_average;
  const numericRating = typeof rawRating === "number" ? rawRating : Number(rawRating);
  return Number.isFinite(numericRating) && numericRating > 0
    ? numericRating.toFixed(1)
    : null;
}

function getDisplayGenres(show: Show): string[] {
  if (!Array.isArray(show.genres)) {
    return [];
  }
  return show.genres
    .filter((genre): genre is string => typeof genre === "string" && genre.trim().length > 0)
    .slice(0, 2);
}

const loadWithFallback = async (
  primary: () => Promise<Show[]>,
  fallback?: () => Promise<Show[]>
): Promise<Show[]> => {
  try {
    return normalizeDiscoverShows(await primary());
  } catch (primaryError) {
    console.warn("Discover source failed", primaryError);
    if (!fallback) {
      return [];
    }
    try {
      return normalizeDiscoverShows(await fallback());
    } catch (fallbackError) {
      console.warn("Discover fallback failed", fallbackError);
      return [];
    }
  }
};

  const [shows, setShows] = useState<UserShow[]>([]);
  const [episodesMap, setEpisodesMap] = useState<Record<string, UserEpisode[]>>({});
  const [upNextReadyTimeoutElapsed, setUpNextReadyTimeoutElapsed] = useState(false);
  
  const episodesMapRef = useRef<Record<string, UserEpisode[]>>({});
  useEffect(() => {
    episodesMapRef.current = episodesMap;
  }, [episodesMap]);

  const upNextLibraryKey = useMemo(
    () => shows.map(show => show.id).sort().join("|"),
    [shows]
  );
  const upNextHasAllEpisodes = shows.length === 0 || Object.keys(episodesMap).length >= shows.length;

  useEffect(() => {
    if (upNextHasAllEpisodes) {
      setUpNextReadyTimeoutElapsed(false);
      return;
    }

    setUpNextReadyTimeoutElapsed(false);
    const readyTimer = window.setTimeout(() => setUpNextReadyTimeoutElapsed(true), 8_000);
    return () => window.clearTimeout(readyTimer);
  }, [upNextHasAllEpisodes, upNextLibraryKey, user?.uid]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [addingShowId, setAddingShowId] = useState<number | null>(null);
  const [previewSource, setPreviewSource] = useState<Show | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(() => readStorageValue("nextup_needs_onboarding") === "true");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(readSavedAppTab);
  const [detailsShow, setDetailsShow] = useState<UserShow | null>(null);
  const [detailsRecommendationReason, setDetailsRecommendationReason] = useState<string | null>(null);
  const [trendingShows, setTrendingShows] = useState<Show[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Show[]>([]);
  const [premieringSoon, setPremieringSoon] = useState<Show[]>([]);
  const [hiddenGems, setHiddenGems] = useState<Show[]>([]);
  const [forYou, setForYou] = useState<Show[]>([]);
  const [networkShows, setNetworkShows] = useState<Record<number, Show[]>>({});
  const [appError, setAppError] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>(
    () => normalizeLibraryFilter(readStorageValue("nextup_library_filter"))
  );
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState<"name" | "added" | "progress" | "backlog" | "queue">(() => {
    const saved = readStorageValue("nextup_library_sort");
    return ["name", "added", "progress", "backlog", "queue"].includes(saved || "")
      ? saved as "name" | "added" | "progress" | "backlog" | "queue"
      : "added";
  });
  const [themeMusicEnabled, setThemeMusicEnabled] = useState(readThemeMusicEnabled);
  const [autoSkipEnabled, setAutoSkipEnabled] = useState(readAutoSkipEnabled);
  const [recommendedPick, setRecommendedPick] = useState<{ show: UserShow, nextEp: UserEpisode, progress: number } | null>(null);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [showExtendedDiscoverRows, setShowExtendedDiscoverRows] = useState(false);
  const [recommendationProfile, setRecommendationProfile] = useState<RecommendationProfile>(EMPTY_RECOMMENDATION_PROFILE);
  const generationRef = useRef(0);
  const discoverFetchedRef = useRef(false);
  const extendedDiscoverFetchedRef = useRef(false);
  const discoverRequestRef = useRef<Promise<void> | null>(null);
  const extendedDiscoverRequestRef = useRef<Promise<void> | null>(null);
  const lastFetchedShowsLengthRef = useRef(-1);
  const playbackOpenerRef = useRef<HTMLElement | null>(null);
  const detailsOpenerRef = useRef<HTMLElement | null>(null);
  const searchOpenerRef = useRef<HTMLElement | null>(null);
  const settingsOpenerRef = useRef<HTMLElement | null>(null);
  const lastMainFocusRef = useRef<HTMLElement | null>(null);
  const lastBackHandledAtRef = useRef(0);
  const exitArmedUntilRef = useRef(0);
  const detailsScrollPositionRef = useRef(0);
  const persistentFocusRestoreKeyRef = useRef("");
  const focusPersistTimerRef = useRef<number | null>(null);
  const prewarmAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("nextup_library_filter", libraryFilter);
      localStorage.setItem("nextup_library_sort", librarySort);
    } catch {
      // Filtering and sorting remain available when storage is unavailable.
    }
  }, [libraryFilter, librarySort]);

  useEffect(() => {
    saveThemeMusicEnabled(themeMusicEnabled);
  }, [themeMusicEnabled]);

  useEffect(() => {
    saveAutoSkipEnabled(autoSkipEnabled);
  }, [autoSkipEnabled]);

  useEffect(() => {
    if (!user?.uid) {
      setRecommendationProfile(EMPTY_RECOMMENDATION_PROFILE);
      return;
    }
    setRecommendationProfile(readRecommendationProfile(window.localStorage, user.uid));
  }, [user?.uid]);

  useEffect(() => {
    let persistTimer: number | null = null;
    try {
      localStorage.setItem("nextup_active_tab", activeTab);
      const savedScroll = Number(localStorage.getItem(`nextup_tab_scroll:${activeTab}`));
      window.setTimeout(() => window.scrollTo({ top: Number.isFinite(savedScroll) ? savedScroll : 0, behavior: "auto" }), 0);
    } catch {
      // The app still opens at the top when storage is unavailable.
    }

    const rememberScroll = () => {
      if (persistTimer !== null) window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        persistTimer = null;
        try {
          localStorage.setItem(`nextup_tab_scroll:${activeTab}`, String(Math.round(window.scrollY)));
        } catch {
          // Scroll restoration is optional polish.
        }
      }, 180);
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", rememberScroll);
      if (persistTimer !== null) window.clearTimeout(persistTimer);
      try {
        localStorage.setItem(`nextup_tab_scroll:${activeTab}`, String(Math.round(window.scrollY)));
      } catch {
        // Scroll restoration is optional polish.
      }
    };
  }, [activeTab]);

  const rememberFocus = useCallback((targetRef: { current: HTMLElement | null }) => {
    targetRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  const restoreFocus = useCallback((targetRef: { current: HTMLElement | null }) => {
    const preferred = targetRef.current;
    targetRef.current = null;

    window.setTimeout(() => {
      const target = preferred?.isConnected
        ? preferred
        : lastMainFocusRef.current?.isConnected
          ? lastMainFocusRef.current
          : document.querySelector<HTMLElement>("[data-tv-main] [data-tv-default-focus], #tv-nav-up-next");
      target?.focus({ preventScroll: true });
    }, 80);
  }, []);

  useEffect(() => {
    const rememberMainFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest("[role='dialog'][aria-modal='true']")) return;
      lastMainFocusRef.current = event.target;
      const focusKey = event.target.dataset.tvFocusKey;
      if (focusKey && event.target.closest("[data-tv-main]") && user?.uid) {
        if (focusPersistTimerRef.current !== null) window.clearTimeout(focusPersistTimerRef.current);
        focusPersistTimerRef.current = window.setTimeout(() => {
          focusPersistTimerRef.current = null;
          try {
            localStorage.setItem(`nextup_focus_key:${user.uid}:${activeTab}`, focusKey);
          } catch {
            // Focus restoration is optional polish.
          }
        }, 180);
      }
    };

    window.addEventListener("focusin", rememberMainFocus);
    return () => {
      window.removeEventListener("focusin", rememberMainFocus);
      if (focusPersistTimerRef.current !== null) {
        window.clearTimeout(focusPersistTimerRef.current);
        focusPersistTimerRef.current = null;
      }
    };
  }, [activeTab, user?.uid]);

  const openDetails = useCallback((show: UserShow, recommendationReason?: string) => {
    rememberFocus(detailsOpenerRef);
    detailsScrollPositionRef.current = window.scrollY;
    setDetailsRecommendationReason(recommendationReason || null);
    setDetailsShow(show);
  }, [rememberFocus]);

  const closeDetails = useCallback(() => {
    setDetailsShow(null);
    setPreviewSource(null);
    setDetailsRecommendationReason(null);
    restoreFocus(detailsOpenerRef);
    const savedScroll = detailsScrollPositionRef.current;
    window.setTimeout(() => window.scrollTo({ top: savedScroll, behavior: "auto" }), 90);
  }, [restoreFocus]);

  const openSearch = useCallback(() => {
    rememberFocus(searchOpenerRef);
    setIsSearchOpen(true);
  }, [rememberFocus]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    restoreFocus(searchOpenerRef);
  }, [restoreFocus]);

  const openSettings = useCallback(() => {
    rememberFocus(settingsOpenerRef);
    setIsSettingsOpen(true);
  }, [rememberFocus]);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    restoreFocus(settingsOpenerRef);
  }, [restoreFocus]);

  const getSavedResumePosition = useCallback((showId: string, episodeId: string): number | null => {
    if (!user?.uid) return null;
    const record = readPlaybackProgress(window.localStorage, user.uid, showId, episodeId);
    return getResumePosition(record);
  }, [playbackProgressRevision, user?.uid]);

  const playbackPercentageByShow = useMemo(() => {
    if (!user?.uid) return new Map<string, number>();
    return buildPlaybackPercentageIndex(window.localStorage, user.uid);
  }, [playbackProgressRevision, user?.uid]);

  const handleRecommendationFeedback = useCallback((kind: RecommendationFeedbackKind) => {
    if (!user?.uid || !previewSource) return;
    const nextProfile = applyRecommendationFeedback(recommendationProfile, previewSource, kind);
    setRecommendationProfile(nextProfile);
    writeRecommendationProfile(window.localStorage, user.uid, nextProfile);

    const messages: Record<RecommendationFeedbackKind, string> = {
      "more-like-this": `NextUp will look for more titles like ${previewSource.name}`,
      "not-for-me": `${previewSource.name} will no longer be recommended`,
      "already-watched": `${previewSource.name} marked as already watched for recommendations`
    };
    setToast({ message: messages[kind] });
    if (kind !== "more-like-this") closeDetails();
  }, [closeDetails, previewSource, recommendationProfile, user?.uid]);

  const handlePlayEpisode = useCallback((showId: string, imdbId: string | undefined, episode: UserEpisode) => {
    let show = shows.find(candidate => candidate.id === showId);
    if (!show && detailsShow?.id === showId) show = detailsShow;
    if (!show) return;

    rememberFocus(playbackOpenerRef);
    const request = createPlaybackRequest(show, episode);
    if (imdbId && imdbId !== "none") request.imdbId = imdbId;

    const resumePosition = getSavedResumePosition(request.showId, request.episodeId);
    if (resumePosition !== null) {
      setPendingPlaybackChoice({ request, resumePosition });
    } else {
      setPlaybackRequest(request);
    }
  }, [detailsShow, getSavedResumePosition, rememberFocus, shows]);

  const cancelPlaybackChoice = useCallback(() => {
    setPendingPlaybackChoice(null);
    restoreFocus(playbackOpenerRef);
  }, [restoreFocus]);

  const resumePendingPlayback = useCallback(() => {
    if (!pendingPlaybackChoice) return;
    const request = pendingPlaybackChoice.request;
    setPendingPlaybackChoice(null);
    setPlaybackRequest(request);
  }, [pendingPlaybackChoice]);

  const startPendingPlaybackOver = useCallback(() => {
    if (!pendingPlaybackChoice) return;
    const request = pendingPlaybackChoice.request;
    if (user?.uid) {
      clearPlaybackProgress(window.localStorage, user.uid, request.showId, request.episodeId);
      setPlaybackProgressRevision(revision => revision + 1);
    }
    setPendingPlaybackChoice(null);
    setPlaybackRequest(request);
  }, [pendingPlaybackChoice, user?.uid]);

  const closePlayback = useCallback(() => {
    setPlaybackRequest(null);
    setPlaybackProgressRevision(revision => revision + 1);
    restoreFocus(playbackOpenerRef);
  }, [restoreFocus]);

  const handleWarmSource = useCallback((show: UserShow, episode: UserEpisode) => {
    if (!show.imdbId || show.imdbId === "none" || playbackRequest) return;
    prewarmAbortRef.current?.abort();
    const controller = new AbortController();
    prewarmAbortRef.current = controller;
    void getBestAioStreamsSources(
      show.imdbId,
      episode.season,
      episode.number,
      show.isMovie ? "movie" : "series",
      controller.signal
    ).catch(error => {
      if ((error as { name?: string })?.name !== "AbortError") {
        console.warn("Playback source prewarm failed", error);
      }
    }).finally(() => {
      if (prewarmAbortRef.current === controller) prewarmAbortRef.current = null;
    });
  }, [playbackRequest]);

  useEffect(() => {
    if (playbackRequest) {
      prewarmAbortRef.current?.abort();
      prewarmAbortRef.current = null;
    }
    return () => {
      prewarmAbortRef.current?.abort();
      prewarmAbortRef.current = null;
    };
  }, [playbackRequest]);

  useEffect(() => {
    const handleTvBack = (event: KeyboardEvent) => {
      if (!isTvBackKey(event)) return;
      if (detailsShow && document.querySelector("[role='alertdialog'][aria-modal='true']")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const now = Date.now();
      if (shouldIgnoreBackPress(event.repeat, now, lastBackHandledAtRef.current)) return;
      lastBackHandledAtRef.current = now;

      const decision = resolveBackAction({
        player: Boolean(playbackRequest),
        resumeChoice: Boolean(pendingPlaybackChoice),
        recommendation: Boolean(recommendedPick),
        details: Boolean(detailsShow),
        search: isSearchOpen,
        settings: isSettingsOpen,
        error: Boolean(appError)
      }, now, exitArmedUntilRef.current);
      exitArmedUntilRef.current = decision.exitArmedUntil;

      switch (decision.action) {
        case "player":
          setPlayerBackRequest(request => request + 1);
          break;
        case "resume-choice":
          cancelPlaybackChoice();
          break;
        case "recommendation":
          setRecommendedPick(null);
          restoreFocus({ current: lastMainFocusRef.current });
          break;
        case "details":
          closeDetails();
          break;
        case "search":
          closeSearch();
          break;
        case "settings":
          closeSettings();
          break;
        case "error":
          setAppError(null);
          break;
        case "exit":
          platformBack();
          break;
        case "arm-exit":
          setToast({ message: "Press Back again to exit NextUp" });
          break;
      }
    };

    window.addEventListener("keydown", handleTvBack, true);
    return () => window.removeEventListener("keydown", handleTvBack, true);
  }, [
    appError,
    cancelPlaybackChoice,
    closeDetails,
    closeSearch,
    closeSettings,
    detailsShow,
    isSearchOpen,
    isSettingsOpen,
    pendingPlaybackChoice,
    playbackRequest,
    recommendedPick,
    restoreFocus
  ]);


  useEffect(() => {
    if (user && readStorageValue("nextup_needs_onboarding") === "true") {
      setIsOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user || playbackRequest) return;

    const warmConnection = () => {
      void warmAioStreamsConnection();
    };
    const initialTimer = window.setTimeout(warmConnection, 1_200);
    const keepWarmTimer = window.setInterval(warmConnection, 10 * 60_000);
    window.addEventListener("online", warmConnection);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(keepWarmTimer);
      window.removeEventListener("online", warmConnection);
    };
  }, [playbackRequest, user?.uid]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u?.uid !== user?.uid) {
        generationRef.current += 1;
        
        setShows([]);
        setEpisodesMap({});
        setTrendingShows([]);
        setTrendingMovies([]);
        setPremieringSoon([]);
        setHiddenGems([]);
        setForYou([]);
        setNetworkShows({});
        setPlaybackRequest(null);
        setPendingPlaybackChoice(null);
        setDetailsShow(null);
        setLibraryFilter("all");
        setLibrarySearch("");
        setLibrarySort("added");
        setRecommendedPick(null);
        setPreviewSource(null);
        setAddingShowId(null);
        setIsSearchOpen(false);
        setIsSettingsOpen(false);
        setAppError(null);
        setDiscoverError(null);
        
        discoverFetchedRef.current = false;
        extendedDiscoverFetchedRef.current = false;
        discoverRequestRef.current = null;
        extendedDiscoverRequestRef.current = null;
        prewarmAbortRef.current?.abort();
        prewarmAbortRef.current = null;
        lastFetchedShowsLengthRef.current = -1;
      }
      
      setUser(u);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (user) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          import("./components/SearchModal");
          import("./components/DetailsModal");
        });
      } else {
        setTimeout(() => {
          import("./components/SearchModal");
          import("./components/DetailsModal");
        }, 2000);
      }
    }
  }, [user]);



  type JobState = {
    inFlight: boolean;
    lastSuccess: number;
    failureCount: number;
    nextAttemptAt: number;
  };

  const reconcileJobsRef = useRef<Map<string, { eps: JobState, meta: JobState }>>(new Map());

  useEffect(() => {
    if (!user || shows.length === 0 || playbackRequest) return;
    
    const runReconciliation = async () => {
      const currentGen = generationRef.current;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const EPISODE_REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
      const MAX_BACKOFF = 4 * 60 * 60 * 1000; // 4 hours max backoff

      for (const show of shows) {
        if (currentGen !== generationRef.current) return;
        const jobId = show.id;
        
        let jobs = reconcileJobsRef.current.get(jobId);
        if (!jobs) {
          jobs = {
            eps: { inFlight: false, lastSuccess: 0, failureCount: 0, nextAttemptAt: 0 },
            meta: { inFlight: false, lastSuccess: 0, failureCount: 0, nextAttemptAt: 0 }
          };
          reconcileJobsRef.current.set(jobId, jobs);
        }

        const now = Date.now();
        const numId = typeof show.id === 'string' ? parseInt(show.id, 10) : show.id;
        let id = show.tvmazeId !== undefined ? show.tvmazeId : numId;
        const tmdbId = show._tmdbId || (show.isMovie && id < 0 ? (-id - 1000000000) : undefined);
        
        // Resolve imported/legacy series IDs without blocking reconciliation for
        // every show that follows this one in the library.
        if (!show.isMovie && id < 0) {
          if (!jobs.meta.inFlight && now >= jobs.meta.nextAttemptAt) {
            jobs.meta.inFlight = true;
            void (async () => {
              try {
                const resolved = await resolveTVMazeShow({ id, name: show.name, externals: { imdb: show.imdbId }, _tmdbId: show._tmdbId, isMovie: false } as any);
                if (!resolved || resolved.id <= 0) throw new Error("No matching TVMaze series found");
                if (currentGen === generationRef.current) {
                  await setDoc(doc(db, `users/${user.uid}/shows/${show.id}`), removeUndefined({
                    tvmazeId: resolved.id,
                    imdbId: resolved.externals?.imdb || show.imdbId || "none",
                    status: resolved.status || show.status,
                    genres: resolved.genres || show.genres || [],
                    lastRefreshed: now
                  }), { merge: true });
                }
                jobs.meta.lastSuccess = now;
                jobs.meta.failureCount = 0;
                jobs.meta.nextAttemptAt = 0;
              } catch (e) {
                console.error("Reconciliation resolution failed for negative ID", show.name, e);
                jobs.meta.failureCount++;
                jobs.meta.nextAttemptAt = now + Math.min(MAX_BACKOFF, Math.pow(2, jobs.meta.failureCount) * 60000);
              } finally {
                jobs.meta.inFlight = false;
              }
            })();
          }
          continue;
        }
        
        // Metadata needs logic
        const CURRENT_AUDIT_VERSION = 1;
        const needsAudit = (show as any)._auditVersion !== CURRENT_AUDIT_VERSION;

        // Re-check metadata if imdbId is missing, empty, or set to "none", or if 7 days have passed
        const isImdbInvalid = !show.imdbId || show.imdbId === "none" || show.imdbId === "";
        const metaDueTime = show.lastRefreshed ? show.lastRefreshed + SEVEN_DAYS : 0;
        const needsMetadataRefresh = !show.isMovie && id > 0 && (isImdbInvalid || now > metaDueTime || needsAudit);
        const needsMovieImdb = show.isMovie && (isImdbInvalid || needsAudit);

        // Episode needs logic
        const epsObj = episodesMapRef.current[jobId];
        const epsDueTime = jobs.eps.lastSuccess + EPISODE_REFRESH_INTERVAL;
        const needsEpisodes = !epsObj || now > epsDueTime;

        // Handle Metadata
        if ((needsMetadataRefresh || needsMovieImdb) && !jobs.meta.inFlight && now >= jobs.meta.nextAttemptAt) {
          jobs.meta.inFlight = true;
          (async () => {
             try {
               if (needsMovieImdb) {
                 let resolvedImdb: string | undefined = undefined;
                 if (tmdbId) {
                   try {
                     const extIds = await getTMDBExternalIds(tmdbId, true);
                     resolvedImdb = extIds.imdb || undefined;
                   } catch (e) {}
                 }
                 if (currentGen === generationRef.current && resolvedImdb) {
                   await setDoc(doc(db, `users/${user.uid}/shows/${show.id}`), removeUndefined({ imdbId: resolvedImdb, _tmdbId: tmdbId, _auditVersion: CURRENT_AUDIT_VERSION }), { merge: true });
                 } else if (currentGen === generationRef.current) {
                   await setDoc(doc(db, `users/${user.uid}/shows/${show.id}`), { _auditVersion: CURRENT_AUDIT_VERSION }, { merge: true });
                 }
               } else if (!show.isMovie && id > 0) {
                 const freshShow = await getShow(id);
                 let resolvedImdb = freshShow.externals?.imdb;
                 
                 if (currentGen === generationRef.current) {
                   await setDoc(doc(db, `users/${user.uid}/shows/${show.id}`), removeUndefined({
                       status: freshShow.status || show.status,
                       imdbId: resolvedImdb || show.imdbId || undefined,
                       genres: freshShow.genres || show.genres || [],
                       officialSite: freshShow.officialSite || show.officialSite || "",
                       lastRefreshed: now,
                       _auditVersion: CURRENT_AUDIT_VERSION
                   }), { merge: true });
                 }
               }
               jobs.meta.lastSuccess = now;
               jobs.meta.failureCount = 0;
               jobs.meta.nextAttemptAt = 0;
             } catch (e) {
               console.error("Meta reconciliation failed for", show.name, e);
               jobs.meta.failureCount++;
               jobs.meta.nextAttemptAt = now + Math.min(MAX_BACKOFF, Math.pow(2, jobs.meta.failureCount) * 60000); // starts at 2min, 4min, 8min...
             } finally {
               jobs.meta.inFlight = false;
             }
          })();
        }

        // Handle Episodes
        if (needsEpisodes && !jobs.eps.inFlight && now >= jobs.eps.nextAttemptAt) {
          jobs.eps.inFlight = true;
          (async () => {
             try {
               const eps = await getShowEpisodes(id, show.watchedEpisodes || {}, show.isMovie, show.premiered);
               if (currentGen === generationRef.current) {
                 setEpisodesMap(current => ({
                   ...current,
                   [show.id]: preserveLatestEpisodeWatchState(eps, current[show.id])
                 }));
               }
               jobs.eps.lastSuccess = now;
               jobs.eps.failureCount = 0;
               jobs.eps.nextAttemptAt = 0;
             } catch (e) {
               console.error("Episode reconciliation failed for", show.name, e);
               jobs.eps.failureCount++;
               jobs.eps.nextAttemptAt = now + Math.min(MAX_BACKOFF, Math.pow(2, jobs.eps.failureCount) * 60000);
             } finally {
               jobs.eps.inFlight = false;
             }
          })();
        }
      }
    };
    
    runReconciliation();
    
    const interval = setInterval(runReconciliation, 5 * 60 * 1000); // Check every 5 minutes
    const onVis = () => { if (document.visibilityState === 'visible') runReconciliation(); };
    const onOn = () => runReconciliation();
    
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOn);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOn);
    };
  }, [playbackRequest, shows, user]);
  
  const fetchLibrary = () => {
    if (!user) return;
    
    setAppError(null);
    const showsRef = collection(db, `users/${user.uid}/shows`);
    const q = query(showsRef);
    
    return onSnapshot(q, async (snapshot) => {
      const currentGen = generationRef.current;
      try {
        const userShows = snapshot.docs
          .map(d => parseLibraryShowRecord(d.data(), d.id))
          .filter((show): show is UserShow => Boolean(show));
        setShows(userShows);
        
        const asyncTasks: Promise<void>[] = [];
        
        setEpisodesMap(prevEpsMap => {
          const newEpsMap = { ...prevEpsMap };
          
          snapshot.docChanges().forEach(change => {
            const show = parseLibraryShowRecord(change.doc.data(), change.doc.id);
            if (!show) {
              delete newEpsMap[change.doc.id];
              return;
            }
            if (change.type === 'removed') {
              delete newEpsMap[show.id];
            } else if (change.type === 'modified') {
              const existingEps = newEpsMap[show.id];
              if (existingEps) {
                newEpsMap[show.id] = existingEps.map(ep => ({
                  ...ep,
                  watched: !!(show.watchedEpisodes && show.watchedEpisodes[ep.id]),
                  watchedAt: show.watchedEpisodes ? (show.watchedEpisodes[ep.id] || undefined) : undefined
                }));
              }
            }
          });
          return newEpsMap;
        });
      } catch (err) {
        console.error("Failed to parse shows snapshot", err);
      }
    }, (error) => {
      console.error("Library subscription failed", error);
      setAppError("Library updates are temporarily unavailable. NextUp will retry when the connection returns.");
    });
  };

  const handleAddShow = async (show: Show, caughtUp: boolean = false) => {
    if (!user) return false;
    setAddingShowId(show.id);
    setAppError(null);
    try {
      const { userShow, userEpisodes } = await addShowToLibrary(show, caughtUp);
      if (userEpisodes && userEpisodes.length > 0) {
        setEpisodesMap(prev => ({
          ...prev,
          [userShow.id]: userEpisodes
        }));
      }
      setShows(previous => previous.some(item => item.id === userShow.id)
        ? previous
        : [...previous, userShow]);
      setAddingShowId(null);
      setToast({ message: caughtUp ? `Added ${userShow.name} (Caught Up)` : `Added ${userShow.name} to Library` });
      return true;
    } catch (err: any) {
      console.error("Failed to add show:", err);
      setAppError(err.message || "Failed to add show. Please try again.");
      setAddingShowId(null);
      return false;
    }
  };

  const toggleWatched = async (showId: string, epId: string, watched: boolean) => {
    if (!user) return;
    
    // Optimistic update
    setEpisodesMap(prev => {
      const eps = prev[showId] || [];
      return {
        ...prev,
        [showId]: eps.map(e => e.id === epId ? { ...e, watched, watchedAt: watched ? Date.now() : undefined } : e)
      };
    });

    try {
      await markEpisodeWatched(showId, epId, watched);
    } catch (err) {
      console.error("Failed to mark watched", err);
      // Rollback specific episode
      setEpisodesMap(prev => {
        const eps = prev[showId] || [];
        return {
          ...prev,
          [showId]: eps.map(e => e.id === epId ? { ...e, watched: !watched } : e)
        };
      });
      setAppError("Failed to save changes. Please check your connection.");
    }
  };

  const handleMarkThrough = async (showId: string, epIds: string[]) => {
    // Store original watched states for rollback
    const originalStates: Record<string, boolean> = {};
    const eps = episodesMap[showId] || [];
    epIds.forEach(id => {
      const ep = eps.find(e => e.id === id);
      if (ep) originalStates[id] = !!ep.watched;
    });

    const watchedAt = Date.now();
    setEpisodesMap(prev => {
      const eps = prev[showId] || [];
      return {
        ...prev,
        [showId]: eps.map(e => epIds.includes(e.id) ? { ...e, watched: true, watchedAt } : e)
      };
    });
    
    try {
      await markEpisodesWatchedBatch(showId, epIds, true);
    } catch (err) {
      console.error("Failed to batch mark watched", err);
      // Rollback specific episodes
      setEpisodesMap(prev => {
        const eps = prev[showId] || [];
        return {
          ...prev,
          [showId]: eps.map(e => epIds.includes(e.id) ? { ...e, watched: originalStates[e.id] } : e)
        };
      });
      setAppError("Failed to save changes. Please check your connection.");
    }
  };

  const handleSetShowProgress = async (showId: string, lastWatchedEpisodeId: string | null) => {
    const selection = buildEpisodeProgressSelection(episodesMap[showId] || [], lastWatchedEpisodeId);
    if (!selection) return;
    const { watchedIds, unwatchedIds } = selection;
    const changedIds = new Set([...watchedIds, ...unwatchedIds]);
    const originalStates = new Map(
      (episodesMap[showId] || [])
        .filter(episode => changedIds.has(episode.id))
        .map(episode => [episode.id, { watched: episode.watched, watchedAt: episode.watchedAt }])
    );
    const watchedIdSet = new Set(watchedIds);
    const unwatchedIdSet = new Set(unwatchedIds);
    const watchedAt = Date.now();

    setEpisodesMap(previous => ({
      ...previous,
      [showId]: (previous[showId] || []).map(episode => {
        if (watchedIdSet.has(episode.id)) return { ...episode, watched: true, watchedAt: episode.watchedAt || watchedAt };
        if (unwatchedIdSet.has(episode.id)) return { ...episode, watched: false, watchedAt: undefined };
        return episode;
      })
    }));

    try {
      await setEpisodeProgress(showId, watchedIds, unwatchedIds);
      setToast({
        message: lastWatchedEpisodeId === null ? "Series progress reset" : "Series progress updated",
        action: {
          label: "Undo",
          onClick: async () => {
            const originallyWatchedIds: string[] = [];
            const originallyUnwatchedIds: string[] = [];
            originalStates.forEach((state, episodeId) => {
              if (state.watched) originallyWatchedIds.push(episodeId);
              else originallyUnwatchedIds.push(episodeId);
            });
            setEpisodesMap(previous => ({
              ...previous,
              [showId]: (previous[showId] || []).map(episode => {
                const original = originalStates.get(episode.id);
                return original ? { ...episode, watched: original.watched, watchedAt: original.watchedAt } : episode;
              })
            }));
            try {
              await setEpisodeProgress(showId, originallyWatchedIds, originallyUnwatchedIds);
              setToast({ message: "Previous series progress restored" });
            } catch (error) {
              console.error("Failed to restore show progress", error);
              setAppError("Failed to restore previous progress. Please check your connection.");
            }
          }
        }
      });
    } catch (err) {
      console.error("Failed to set show progress", err);
      setEpisodesMap(previous => ({
        ...previous,
        [showId]: (previous[showId] || []).map(episode => {
          const original = originalStates.get(episode.id);
          return original ? { ...episode, watched: original.watched, watchedAt: original.watchedAt } : episode;
        })
      }));
      setAppError("Failed to save progress. Please check your connection.");
    }
  };

  const handleRemoveShow = async () => {
    if (!detailsShow) return;
    const removedShow = detailsShow;
    const removedEpisodes = [...(episodesMap[removedShow.id] || [])];
    const removedShowSnapshot: UserShow = {
      ...removedShow,
      watchedEpisodes: Object.fromEntries(
        removedEpisodes
          .filter(episode => episode.watched)
          .map(episode => [episode.id, episode.watchedAt || removedShow.watchedEpisodes?.[episode.id] || Date.now()])
      )
    };

    try {
      const removedDocumentIds = new Set(getLibraryDocumentIds(removedShow));
      await removeShowFromLibrary(removedShow);
      setShows(previousShows => previousShows.filter(show => !removedDocumentIds.has(show.id)));
      setEpisodesMap(previousEpisodes => {
        const nextEpisodes = { ...previousEpisodes };
        removedDocumentIds.forEach(documentId => delete nextEpisodes[documentId]);
        return nextEpisodes;
      });
      closeDetails();
      setToast({
        message: `Removed ${removedShow.name}`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreShowToLibrary(removedShowSnapshot);
              setShows(previousShows => previousShows.some(show => show.id === removedShowSnapshot.id)
                ? previousShows
                : [removedShowSnapshot, ...previousShows]);
              setEpisodesMap(previousEpisodes => ({
                ...previousEpisodes,
                [removedShowSnapshot.id]: removedEpisodes
              }));
              setToast({ message: `Restored ${removedShowSnapshot.name}` });
            } catch (error) {
              console.error("Failed to restore show", error);
              setAppError("Failed to restore the removed title. Please check your connection.");
            }
          }
        }
      });
    } catch (err) {
      console.error("Failed to remove show", err);
      setAppError("Failed to remove show. Please check your connection.");
      throw err;
    }
  };

  useEffect(() => {
    const refreshTimeline = () => setTimelineRevision(revision => revision + 1);
    const interval = window.setInterval(refreshTimeline, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshTimeline();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", refreshTimeline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", refreshTimeline);
    };
  }, []);

  const { upNext, comingSchedule, filteredLibrary } = useMemo(() => {
    const now = new Date();
    const backlogByShow = new Map(shows.map(show => [
      show.id,
      buildEpisodeBacklog(episodesMap[show.id] || [], show.runtime || 0, now)
    ]));
    
    const upNextRaw = rankUpNextItems(shows.map(show => {
      const eps = episodesMap[show.id] || [];
      const backlog = backlogByShow.get(show.id)!;
      const { percentage } = calculateProgress(eps, false);

      return {
        show: { ...show, episodes: eps },
        nextEp: backlog.firstUnwatched,
        progress: percentage,
        backlog
      };
    }).filter((item): item is { show: UserShow & { episodes: UserEpisode[] }, nextEp: UserEpisode, progress: number, backlog: ReturnType<typeof buildEpisodeBacklog> } => Boolean(item.nextEp)));

    const comingScheduleRaw = buildComingSchedule(shows, episodesMap, now);

    let lib = [...shows];
    
    // LibraryTab classifies and filters the sorted titles into shelves.

    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      lib = lib.filter(s => String(s.name || "").toLowerCase().includes(q));
    }

    lib.sort((a, b) => {
      if (librarySort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (librarySort === "added") return (b.addedAt || 0) - (a.addedAt || 0);
      if (librarySort === "progress") {
        const epsA = episodesMap[a.id] || [];
        const epsB = episodesMap[b.id] || [];
        const pctA = calculateProgress(epsA).percentage;
        const pctB = calculateProgress(epsB).percentage;
        return pctB - pctA;
      }
      if (librarySort === "backlog") {
        return (backlogByShow.get(b.id)?.unwatchedCount || 0) - (backlogByShow.get(a.id)?.unwatchedCount || 0);
      }
      if (librarySort === "queue") {
        const queueOrder = new Map(upNextRaw.map((item, index) => [item.show.id, index]));
        return (queueOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (queueOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });

    return { upNext: upNextRaw, comingSchedule: comingScheduleRaw, filteredLibrary: lib };
  }, [shows, episodesMap, librarySort, librarySearch, timelineRevision]);

  const nextPlaybackRequest = useMemo(() => {
    if (!playbackRequest || playbackRequest.isMovie) return null;

    const show = shows.find(candidate => candidate.id === playbackRequest.showId) ||
      (detailsShow?.id === playbackRequest.showId ? detailsShow : null);
    if (!show) return null;

    const nextEpisode = findNextReleasedEpisode(
      episodesMap[show.id] || show.episodes || [],
      playbackRequest
    );
    return nextEpisode ? createPlaybackRequest(show, nextEpisode) : null;
  }, [detailsShow, episodesMap, playbackRequest, shows]);

  const creditsUpNextRequests = useMemo(() => {
    if (!playbackRequest || playbackRequest.isMovie || nextPlaybackRequest) return [];
    return upNext
      .filter(item => item.show.id !== playbackRequest.showId)
      .slice(0, 3)
      .map(item => createPlaybackRequest(item.show, item.nextEp));
  }, [nextPlaybackRequest, playbackRequest, upNext]);

  const handlePlaybackCompleted = () => {
    if (!playbackRequest) return;
    const show = shows.find(candidate => candidate.id === playbackRequest.showId) ||
      (detailsShow?.id === playbackRequest.showId ? detailsShow : null);
    const currentEpisode = (episodesMap[playbackRequest.showId] || show?.episodes || [])
      .find(episode => episode.id === playbackRequest.episodeId);

    if (show && !currentEpisode?.watched) {
        void toggleWatched(show.id, playbackRequest.episodeId, true);
    }
  };

  useEffect(() => {
    if (!playbackRequest && shows.length > 0 && Object.keys(episodesMap).length > 0) {
      const runCheck = () => {
        const showsWithEps = shows.map(s => ({
          ...s,
          episodes: episodesMap[s.id] || s.episodes || []
        }));
        checkAndNotifyUpcomingEpisodes(showsWithEps);
      };
      
      runCheck();
      
      const interval = setInterval(runCheck, 5 * 60 * 1000);
      
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') runCheck();
      };
      const onOnline = () => {
        runCheck();
      };
      
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('online', onOnline);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('online', onOnline);
      };
    }
  }, [shows, episodesMap, playbackRequest]);

  const handlePickTonight = () => {
    if (upNext.length === 0) return;
    
    if (upNext.length === 1) {
      setRecommendedPick(upNext[0]);
      return;
    }

    const sorted = [...upNext].sort((a, b) => {
      const aWatchedAt = Object.values(a.show.watchedEpisodes || {}).filter(v => v !== null) as number[];
      const bWatchedAt = Object.values(b.show.watchedEpisodes || {}).filter(v => v !== null) as number[];
      const aMax = aWatchedAt.length ? Math.max(...aWatchedAt) : 0;
      const bMax = bWatchedAt.length ? Math.max(...bWatchedAt) : 0;
      return aMax - bMax; // Oldest first
    });
    const pool = sorted.slice(0, Math.max(3, Math.floor(sorted.length / 2)));
    let picked = pool[Math.floor(Math.random() * pool.length)];
    if (recommendedPick && pool.length > 1) {
      let attempts = 0;
      while (picked.show.id === recommendedPick.show.id && attempts < 10) {
        picked = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      }
    }
    setRecommendedPick(picked);
  };

  const fetchDiscover = async () => {
    if (discoverFetchedRef.current || discoverRequestRef.current) return;
    
    setIsDiscoverLoading(true);
    setDiscoverError(null);
    
    try {
      const p = (async () => {
        const [
          trending,
          movies,
          premiering,
          gems,
          forYouData
        ] = await Promise.all([
          loadWithFallback(getTrendingTMDB, getTrendingTVMaze),
          loadWithFallback(getTrendingMoviesTMDB),
          loadWithFallback(getPremieringSoon),
          loadWithFallback(getHiddenGemsTMDB, getHiddenGems),
          loadWithFallback(getForYouTMDB, getForYou)
        ]);
        
        setTrendingShows(trending);
        setTrendingMovies(movies);
        setPremieringSoon(premiering);
        setHiddenGems(gems);
        setForYou(forYouData);

        if (![trending, movies, premiering, gems, forYouData].some(section => section.length > 0)) {
          throw new Error("No recommendation sources are available right now.");
        }
        discoverFetchedRef.current = true;
      })();
      
      discoverRequestRef.current = p;
      await p;
    } catch (err: any) {
      console.error("Failed to fetch discover data:", err);
      setDiscoverError(err.message || "Failed to load discover content");
    } finally {
      setIsDiscoverLoading(false);
      discoverRequestRef.current = null;
    }
  };

  const fetchExtendedDiscover = async () => {
    if (extendedDiscoverFetchedRef.current || extendedDiscoverRequestRef.current || playbackRequest) return;

    const request = (async () => {
      const batchSize = isWebOSTV() ? 2 : STREAMING_NETWORKS.length;
      for (let index = 0; index < STREAMING_NETWORKS.length; index += batchSize) {
        const networksData = await Promise.all(
          STREAMING_NETWORKS.slice(index, index + batchSize).map(async network => {
            try {
              const shows = await getTopShowsByNetwork(network.id);
              return { id: network.id, shows: isWebOSTV() ? shows.slice(0, 10) : shows };
            } catch (error) {
              console.warn(`Discover network source failed: ${network.name}`, error);
              return { id: network.id, shows: [] as Show[] };
            }
          })
        );

        setNetworkShows(previous => {
          const next = { ...previous };
          for (const network of networksData) next[network.id] = network.shows;
          return next;
        });

        if (isWebOSTV()) await new Promise<void>(resolve => window.setTimeout(resolve, 35));
      }
      extendedDiscoverFetchedRef.current = true;
    })();

    extendedDiscoverRequestRef.current = request;
    try {
      await request;
    } finally {
      extendedDiscoverRequestRef.current = null;
    }
  };

  useEffect(() => {
    if (activeTab === "discover") {
      void fetchDiscover();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "discover" && showExtendedDiscoverRows) {
      void fetchExtendedDiscover();
    }
  }, [activeTab, playbackRequest, showExtendedDiscoverRows]);

  const { watchedLibraryForReasons, finishedLibraryForReasons } = useMemo(() => {
    const watched: UserShow[] = [];
    const finished: UserShow[] = [];
    shows.forEach(show => {
      const releasedEpisodes = getReleasedEpisodes(episodesMap[show.id] || [], false);
      if (!releasedEpisodes.some(episode => episode.watched)) return;
      watched.push(show);
      if (releasedEpisodes.length > 0 && releasedEpisodes.every(episode => episode.watched) && (show.isMovie || show.status === "Ended")) {
        finished.push(show);
      }
    });
    const mostRecentFirst = (first: UserShow, second: UserShow) => {
      const latest = (show: UserShow) => Math.max(0, ...Object.values(show.watchedEpisodes || {}).filter((value): value is number => typeof value === "number"));
      return latest(second) - latest(first);
    };
    return {
      watchedLibraryForReasons: watched.sort(mostRecentFirst),
      finishedLibraryForReasons: finished.sort(mostRecentFirst)
    };
  }, [episodesMap, shows]);

  const { visibleDiscoverSections, hasExtendedDiscoverRows } = useMemo(() => {
    const primaryDiscoverSections: Array<{ id: string; title: string; subtitle: string; shows: Show[]; source: RecommendationSource }> = [
      { id: "popular-picks", title: "Popular picks", subtitle: "Reliable starting points.", shows: forYou, source: { kind: "popular" } },
      { id: "trending", title: "Trending series", subtitle: "Series drawing attention this week.", shows: trendingShows, source: { kind: "trending" } },
      { id: "trending-movies", title: "Trending movies", subtitle: "Popular movies this week.", shows: trendingMovies, source: { kind: "trending" } },
      { id: "hidden-gems", title: "Hidden gems", subtitle: "Strongly rated picks you may have missed.", shows: hiddenGems, source: { kind: "hidden-gem" } }
    ];
    const extendedDiscoverSections: Array<{ id: string; title: string; subtitle: string; shows: Show[]; source: RecommendationSource }> = [
      { id: "premiering", title: "Premiering soon", subtitle: "New series arriving shortly.", shows: premieringSoon, source: { kind: "premiering" } },
      ...STREAMING_NETWORKS.filter(network => networkShows[network.id]?.length > 0).map(network => ({
        id: `network-${network.id}`,
        title: `Top on ${network.name}`,
        subtitle: "",
        shows: networkShows[network.id],
        source: { kind: "network", name: network.name } as RecommendationSource
      }))
    ];
    const rankSection = (section: typeof primaryDiscoverSections[number]) => ({
      ...section,
      shows: rankRecommendationCandidates(
        (section.shows || []).filter(candidate => !isRecommendationCandidateInLibrary(candidate, shows)),
        recommendationProfile,
        shows
      )
    });
    const visible = [
      ...primaryDiscoverSections,
      ...(showExtendedDiscoverRows ? extendedDiscoverSections : [])
    ].map(rankSection).filter(section => section.shows.length > 0);
    const hasLoadedExtendedRows = extendedDiscoverSections.some(section => rankSection(section).shows.length > 0);
    return {
      visibleDiscoverSections: visible,
      hasExtendedDiscoverRows: hasLoadedExtendedRows || !extendedDiscoverFetchedRef.current
    };
  }, [
    forYou,
    hiddenGems,
    networkShows,
    premieringSoon,
    recommendationProfile,
    showExtendedDiscoverRows,
    shows,
    trendingMovies,
    trendingShows
  ]);

  const visibleContentVersion = `${shows.length}:${Object.keys(episodesMap).length}:${visibleDiscoverSections.reduce((count, section) => count + section.shows.length, 0)}`;
  useEffect(() => {
    if (!user?.uid || persistentFocusRestoreKeyRef.current === `${user.uid}:${activeTab}`) return;

    let cancelled = false;
    let timer: number | null = null;
    let attempts = 0;
    const restoreSavedFocus = () => {
      if (cancelled || detailsShow || isSearchOpen || isSettingsOpen || pendingPlaybackChoice || playbackRequest || recommendedPick) return;
      let savedFocusKey: string | null = null;
      try {
        savedFocusKey = localStorage.getItem(`nextup_focus_key:${user.uid}:${activeTab}`);
      } catch {
        return;
      }
      if (!savedFocusKey) return;

      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-tv-focus-key]"))
        .find(element => element.dataset.tvFocusKey === savedFocusKey);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        persistentFocusRestoreKeyRef.current = `${user.uid}:${activeTab}`;
        return;
      }

      attempts += 1;
      if (attempts < 8) timer = window.setTimeout(restoreSavedFocus, 120);
    };

    timer = window.setTimeout(restoreSavedFocus, 100);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeTab, detailsShow, isSearchOpen, isSettingsOpen, pendingPlaybackChoice, playbackRequest, recommendedPick, user?.uid, visibleContentVersion]);

  const bottomNavUpTarget = activeTab === "up-next"
    ? (upNext.length > 0 ? "#up-next-hero-play" : "[data-tv-up-next-screen] [data-tv-default-focus]")
    : activeTab === "discover"
      ? "[data-tv-focus-key^='discover:'], [data-tv-section='discover-more'] button"
      : activeTab === "coming"
        ? "[data-tv-focus-key^='recently-aired:'], [data-tv-focus-key^='coming:']"
        : "[data-tv-focus-key^='library:'], [data-tv-section='library-controls'] button";
  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 pb-24 font-sans text-slate-900 dark:text-white p-4 max-w-7xl mx-auto md:p-8 pt-12 md:pt-16">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-8 text-slate-900 dark:text-white tracking-tight">
          Next<span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text font-black italic text-transparent">Up</span>
        </h1>
        <div className="flex gap-4 mb-8">
          <div className="w-24 h-10 bg-white dark:bg-slate-900 rounded-full animate-pulse" />
          <div className="w-24 h-10 bg-white dark:bg-slate-900 rounded-full animate-pulse" />
          <div className="w-24 h-10 bg-white dark:bg-slate-900 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!user) return <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}><AuthScreen /></Suspense>;

  if (isOnboarding) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}>
        <OnboardingScreen 
          onComplete={() => {
            localStorage.removeItem('nextup_needs_onboarding');
            setIsOnboarding(false);
          }}
          onAddShow={handleAddShow}
          libraryIds={new Set(shows.map(s => parseInt(s.tvmazeId?.toString() || s.id, 10)))}
          libraryImdbs={new Set(shows.map(s => s.imdbId).filter(Boolean) as string[])}
          addingShowId={addingShowId}
        />
      </Suspense>
    );
  }

  return (
    <div className={`nextup-cinema min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans pb-[calc(6rem+env(safe-area-inset-bottom))] ${activeTab === "up-next" ? "tv-up-next-shell" : ""}`}>
      <AmbientBackdrop active={activeTab === "up-next"} />
      {/* Topbar */}
      <header data-tv-app-header="true" className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div data-tv-brand-mark="true" className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Tv className="w-5 h-5 text-slate-950" />
          </div>
          <h1 className="font-display text-xl font-bold leading-none tracking-[-0.04em] text-slate-900 dark:text-white">
            Next<span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text font-black italic text-transparent">Up</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <UserMenu 
            user={user} 
            onOpenSettings={openSettings}
            onSignOut={() => signOut(auth)} 
          />
        </div>
      </header>

      {appError && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex justify-between items-center">
            <span className="text-base font-medium">{appError}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setAppError(null)} className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-red-400 hover:text-red-300">×</button>
          </div>
        </div>
      )}

      <main data-tv-main="true" className="max-w-7xl mx-auto px-4 sm:px-8 py-5 sm:py-8 pb-24 sm:pb-28">
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 sm:space-y-12">



        {/* Discover View */}
        {activeTab === "discover" && (
          <DiscoverErrorBoundary onRetry={fetchDiscover}>
            <section className="space-y-12">
              <div>
                <div className="mb-6">
                  <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">Discover</h2>
                  <p className="text-slate-600 dark:text-slate-400">Personalized by your Library, without repeating what you already saved.</p>
                </div>

                {discoverError ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center max-w-lg mx-auto mt-12 animate-in fade-in">
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">{discoverError}</p>
                    <button 
                      onClick={() => fetchDiscover()}
                      className="bg-orange-500 hover:bg-orange-400 text-orange-950 font-bold py-2 px-6 rounded-full text-sm transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-10">
                      {visibleDiscoverSections.map(section => (
                        <div key={section.id} data-tv-section="true" className="[content-visibility:auto] [contain-intrinsic-size:auto_480px]">
                          <div className="mb-4">
                            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">{section.title}</h3>
                            {section.subtitle && <p className="text-slate-600 dark:text-slate-400 text-base">{section.subtitle}</p>}
                          </div>
                          <ScrollRow storageKey={user?.uid ? `${user.uid}:discover:${section.id}` : `discover:${section.id}`}>
                            {(section.shows || []).filter((show): show is Show => !!(show && show.id && show.name)).map((show) => {
                              const recommendationReason = getRecommendationReason(show, {
                                source: section.source,
                                profile: recommendationProfile,
                                watchedLibrary: watchedLibraryForReasons,
                                finishedLibrary: finishedLibraryForReasons
                              });
                              const detailsButtonId = `discover-details-${section.id}-${show.id}`;
                              const addButtonId = `discover-add-${section.id}-${show.id}`;
                              const isAddingThisShow = addingShowId === show.id;
                              return (
                            <div key={show.id} data-tv-card="true" data-tv-poster-card="true" className="snap-start shrink-0 w-40 md:w-48 lg:w-56 group relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 aspect-[2/3] hover:border-orange-500/50 transition-colors flex flex-col text-left">
                                  <button
                                    id={detailsButtonId}
                                    data-tv-focus-key={`discover:${section.id}:${show.id}`}
                                    data-tv-up={`#${addButtonId}`}
                                    onClick={() => {
                                      setPreviewSource(show);
                                      openDetails({
                                        id: show.id.toString(),
                                        tvmazeId: show.id,
                                        name: show.name,
                                        imageUrl: show.image?.medium || show.image?.original || "",
                                        status: show.status || "Unknown",
                                        provider: show.webChannel?.name || show.network?.name || "",
                                        addedAt: Date.now(),
                                        summary: typeof show.summary === 'string' ? show.summary.replace(/<[^>]+>/g, "") : "",
                                        imdbId: show.externals?.imdb || "",
                                        isMovie: !!show.isMovie,
                                        rating: show.rating || {},
                                        vote_average: typeof show.vote_average === 'number' ? show.vote_average : 0,
                                        genres: Array.isArray(show.genres) ? show.genres : [],
                                        premiered: show.premiered || "",
                                        runtime: show.runtime,
                                        officialSite: show.officialSite || "",
                                        _tmdbId: show._tmdbId
                                      }, recommendationReason);
                                    }}
                              className="absolute inset-0 z-10 touch-manipulation"
                            >
                              <span className="sr-only">View Details for {show.name}</span>
                            </button>
                            <button
                              id={addButtonId}
                              type="button"
                              data-tv-focus-key={`discover-add:${section.id}:${show.id}`}
                              data-tv-down={`#${detailsButtonId}`}
                              disabled={addingShowId !== null}
                              aria-busy={isAddingThisShow}
                              aria-label={`Add ${show.name} to Library`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleAddShow(show, false);
                              }}
                              className="absolute top-2 left-2 z-30 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-extrabold text-orange-950 shadow-lg hover:bg-orange-400 disabled:opacity-70"
                            >
                              <Plus className="w-4 h-4 shrink-0" />
                              {isAddingThisShow ? "Adding..." : "Add"}
                            </button>
                            {show.image?.original || show.image?.medium ? (
                              <img decoding="async" referrerPolicy="no-referrer" loading="lazy" fetchPriority="low" src={show.image.medium || show.image.original} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-800">{(show.name || "?")[0]}</div>
                            )}
                            
                            {getDisplayRating(show) ? (
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 bg-white/90 dark:bg-slate-950/90 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="text-orange-400 text-[11px] tracking-tighter">★</span>
                                <span className="text-slate-900 dark:text-white text-[11px] font-bold">{getDisplayRating(show)}</span>
                              </div>
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                              <div className="relative z-20">
                                <span className="sr-only">View details</span>
                              </div>
                              <h3 className="text-white font-display font-bold leading-tight line-clamp-2 mt-1">{show.name}</h3>
                              <p className="text-orange-100/90 text-xs font-semibold leading-snug line-clamp-2 mt-1.5">{recommendationReason}</p>
                              {getDisplayGenres(show).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5 opacity-80">
                                  {getDisplayGenres(show).map(g => (
                                    <span key={g} className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/80 px-1.5 py-0.5 rounded">{g}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </ScrollRow>
                  </div>
                ))}
                {hasExtendedDiscoverRows && !isDiscoverLoading && (
                  <div data-tv-section="discover-more" className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExtendedDiscoverRows(value => !value)}
                      className="min-h-[56px] rounded-2xl border border-slate-300 bg-white px-8 py-3 text-base font-bold text-slate-800 hover:border-orange-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {showExtendedDiscoverRows ? "Show fewer rows" : "More recommendations"}
                    </button>
                  </div>
                )}
                {isDiscoverLoading && (
                  <div className="space-y-10 animate-pulse mt-10">
                    {[1, 2].map((sectionIndex) => (
                      <div key={sectionIndex}>
                        <div className="mb-4">
                          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48 mb-2"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div>
                        </div>
                        <div className="flex gap-4 overflow-hidden">
                          {[1, 2, 3, 4, 5].map((cardIndex) => (
                            <div key={cardIndex} className="shrink-0 w-40 md:w-48 lg:w-56 aspect-[2/3] bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          </section>
          </DiscoverErrorBoundary>
        )}

        {/* Up Next View */}
        {activeTab === "up-next" && (
          <UpNextTab
              items={upNext}
              isReady={upNextHasAllEpisodes || upNextReadyTimeoutElapsed}
              onPlay={(show, episode) => handlePlayEpisode(show.id, show.imdbId, episode)}
              onFindShow={openSearch}
              getResumePosition={getSavedResumePosition}
              themeMusicEnabled={themeMusicEnabled && !(
                appError ||
                detailsShow ||
                isSearchOpen ||
                isSettingsOpen ||
                pendingPlaybackChoice ||
                playbackRequest ||
                recommendedPick
              )}
              memoryKey={user?.uid}
              onWarmSource={handleWarmSource}
          />
        )}

        {/* Retained fallback layout for non-TV build compatibility. */}
        {false && activeTab === "up-next" && (
          <section>
            <div className="mb-6">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">Ready to watch</h2>
              <p className="text-slate-600 dark:text-slate-400">Pick up exactly where you left off.</p>
            </div>
            {upNext.length > 1 && (
              <button 
                onClick={handlePickTonight}
                className="w-full mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-between hover:from-indigo-500/30 hover:to-purple-500/30 transition-colors group text-left cursor-pointer"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">What should we watch tonight?</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Let us pick from your queue</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center group-active:scale-95 transition-transform shrink-0 shadow-xl shadow-indigo-500/20">
                  <PlayCircle className="w-5 h-5 text-slate-900 dark:text-white" />
                </div>
              </button>
            )}
            
            {upNext.length === 0 && (shows.length === 0 || Object.keys(episodesMap).length >= shows.length) ? (
              <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-3xl p-12 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">You're all caught up!</p>
                <button onClick={openSearch} className="bg-orange-500 text-orange-950 font-bold px-6 py-2.5 rounded-full hover:bg-orange-400 transition-colors">Find a show</button>
              </div>
            ) : upNext.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upNext.map(({ show, nextEp, progress }) => (
                  <SwipeableCard key={show.id} onMark={() => toggleWatched(show.id, nextEp.id, true)}>
                  <article className="relative min-h-[420px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-end hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
                    {/* Background Backdrop Image */}
                    <div className="absolute inset-0 z-0">
                      {show.imageUrl ? (
                        <img 
                          decoding="async" 
                          referrerPolicy="no-referrer" 
                          loading="lazy"
                          fetchPriority="low"
                          src={optimizeArtworkUrl(show.backdropUrl || show.imageUrl)}
                          alt="" 
                          className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-all duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-300 dark:text-slate-800 text-6xl font-bold">{show.name[0]}</div>
                      )}
                      {/* Premium gradual gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                    </div>

                    {/* Card click target to view details */}
                    <button 
                              onClick={() => openDetails(show)}
                      className="absolute inset-0 z-10 w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-3xl"
                      aria-label={`View details for ${show.name}`}
                    />

                    {/* Content Overlays */}
                    <div className="relative z-20 p-5 flex flex-col justify-end h-full pointer-events-none w-full">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[11px] font-bold uppercase tracking-wider">Up Next</span>
                        {show.provider && show.provider !== "Unknown Provider" && show.provider !== "Unknown" && (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 drop-shadow-md bg-white/70 dark:bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-300/40 dark:border-slate-800/40">{show.provider}</span>
                        )}
                      </div>

                      <h3 className="text-xl font-display font-bold text-white leading-tight drop-shadow-lg mb-1">{show.name}</h3>
                      
                      <div className="text-base font-semibold text-slate-200 mb-1 drop-shadow">
                        {show.isMovie ? "Feature Film" : `S${nextEp.season} E${nextEp.number} · ${nextEp.name}`}
                      </div>
                      
                      {getEpisodeReleaseTime(nextEp) && (
                        <div className="text-[11px] font-bold text-orange-400/90 uppercase tracking-wider mb-2">
                          Aired {format(getEpisodeReleaseTime(nextEp) || new Date(), "MMM d, yyyy")}
                        </div>
                      )}
                      
                      <ExpandableText 
                        text={nextEp.summary || show.summary || "No description."} 
                        className="text-xs text-slate-300 leading-relaxed mb-4 pointer-events-auto" 
                        limit={120}
                      />
                      
                      {!(show.isMovie) && (
                        <div className="w-full h-1.5 bg-slate-800/50 rounded-full mb-4 overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      
                      <div className="flex gap-2.5 pointer-events-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleWatched(show.id, nextEp.id, true); }}
                          className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
                        >
                          <CheckCircle2 className="w-4 h-4 text-orange-400" />
                          Mark Watched
                        </button>
                        <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handlePlayEpisode(show.id, show.imdbId, nextEp); 
                            }}
                            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 text-orange-950 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-orange-500/20"
                          >
                            <PlayCircle className="w-4 h-4" />
                            Play
                          </button>
                      </div>
                    </div>
                  </article>
                  </SwipeableCard>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Coming Soon */}
        {activeTab === "coming" && (
          <ComingTab
            schedule={comingSchedule}
            onOpenDetails={openDetails}
            onPlayEpisode={(show, episode) => handlePlayEpisode(show.id, show.imdbId, episode)}
            rowStorageKeyPrefix={user?.uid ? `${user.uid}:` : ""}
          />
        )}
        {activeTab === "library" && (
          <LibraryTab
            filteredLibrary={filteredLibrary}
            shows={shows}
            episodesMap={episodesMap}
            setDetailsShow={openDetails}
            libraryFilter={libraryFilter}
            setLibraryFilter={setLibraryFilter}
            librarySort={librarySort}
            setLibrarySort={setLibrarySort}
            librarySearch={librarySearch}
            setLibrarySearch={setLibrarySearch}
            playbackPercentageByShow={playbackPercentageByShow}
            rowStorageKeyPrefix={user?.uid ? `${user.uid}:` : ""}
          />
        )}
      </div>
      </main>

      {toast && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between sm:justify-start gap-3 animate-in" role="status">
          {toast.message}
          {toast.action && <button onClick={() => { const action = toast.action; setToast(null); void action?.onClick(); }} className="text-orange-400 font-bold">{toast.action.label}</button>}
        </div>
      )}

      {/* Bottom Nav */}
      <div data-tv-bottom-nav-shell="true" className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] z-40">
        <div
          data-tv-bottom-nav="true"
          className="flex items-center px-2 py-2 max-w-md mx-auto"
        >
          {[
            { id: "up-next", label: "Next Up", icon: PlayCircle },
            { id: "discover", label: "Discover", icon: Compass },
            { id: "search", label: "Search", icon: Search, action: openSearch },
            { id: "coming", label: "Coming", icon: Clock },
            { id: "library", label: "Library", icon: CheckCircle2 }
          ].map(t => (
            <button
              key={t.id}
              id={`tv-nav-${t.id}`}
              type="button"
              data-tv-up={bottomNavUpTarget}
              aria-current={!t.action && activeTab === t.id ? "page" : undefined}
              onClick={() => t.action ? t.action() : setActiveTab(t.id as any)}
              className={`relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl transition-colors active:scale-95 ${
                (!t.action && activeTab === t.id) ? "text-orange-500" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <t.icon className="w-6 h-6" />
              <span className="text-[11px] font-medium tracking-wide">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isSettingsOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={closeSettings}
            shows={shows}
            themeMusicEnabled={themeMusicEnabled}
            onThemeMusicEnabledChange={setThemeMusicEnabled}
            autoSkipEnabled={autoSkipEnabled}
            onAutoSkipEnabledChange={setAutoSkipEnabled}
          />
        </Suspense>
      )}
      {isSearchOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SearchModal 
            isOpen={isSearchOpen} 
            onClose={closeSearch}
            onAddShow={handleAddShow} 
            library={shows}
          />
        </Suspense>
      )}

      {detailsShow && (
        <Suspense fallback={<ModalLoadingFallback />}><DetailsModal
          key={detailsShow.id}
          show={detailsShow}
          episodes={episodesMap[detailsShow.id] || []}
          isOpen={!!detailsShow}
          onClose={closeDetails}
          onRemove={handleRemoveShow}
          onToggleWatched={(epId, watched) => toggleWatched(detailsShow.id, epId, watched)}
          onMarkThrough={(epIds) => handleMarkThrough(detailsShow.id, epIds)}
          onSetProgress={(episodeId) => handleSetShowProgress(detailsShow.id, episodeId)}
          inLibrary={shows.some(s => s.tvmazeId === detailsShow.tvmazeId || (!!s.imdbId && s.imdbId === detailsShow.imdbId))}
          onAdd={async (caughtUp) => {
            if (previewSource) {
              const success = await handleAddShow(previewSource, caughtUp);
              if (success) {
                setToast({ message: `Added ${previewSource.name}` });
                closeDetails();
              }
            }
          }}
          addingShowId={addingShowId}
          onPlayEpisode={handlePlayEpisode}
          getResumePosition={getSavedResumePosition}
          recommendationReason={detailsRecommendationReason}
          recommendationFeedback={previewSource ? recommendationProfile.entries[getRecommendationCandidateKey(previewSource)]?.kind : undefined}
          onRecommendationFeedback={previewSource ? handleRecommendationFeedback : undefined}
        />
        </Suspense>
      )}

      {pendingPlaybackChoice && (
        <ResumePlaybackDialog
          request={pendingPlaybackChoice.request}
          resumePosition={pendingPlaybackChoice.resumePosition}
          onResume={resumePendingPlayback}
          onStartOver={startPendingPlaybackOver}
          onCancel={cancelPlaybackChoice}
        />
      )}

      {playbackRequest && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <VideoPlayerModal
            request={playbackRequest}
            nextRequest={nextPlaybackRequest}
            alternativeRequests={creditsUpNextRequests}
            backRequestToken={playerBackRequest}
            autoSkipEnabled={autoSkipEnabled}
            onEpisodeComplete={handlePlaybackCompleted}
            onPlayNext={() => {
              if (nextPlaybackRequest) setPlaybackRequest(nextPlaybackRequest);
            }}
            onPlayAlternative={setPlaybackRequest}
            onClose={closePlayback}
          />
        </Suspense>
      )}

      {recommendedPick && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RecommendationModal
            isOpen={!!recommendedPick}
            onClose={() => {
              setRecommendedPick(null);
              restoreFocus({ current: lastMainFocusRef.current });
            }}
            show={recommendedPick.show}
            episode={recommendedPick.nextEp}
            progress={recommendedPick.progress}
            reason={recommendedPick.progress > 0 ? "Continue a series already in progress" : "A ready-to-watch title from your Library"}
            onPlayEpisode={(showId, imdbId, episode) => {
              handlePlayEpisode(showId, imdbId, episode);
              setRecommendedPick(null);
            }}
            onViewDetails={(show) => {
              openDetails(show);
              setRecommendedPick(null);
            }}
            onReroll={handlePickTonight}
          />
        </Suspense>
      )}
    </div>
  );
}
