import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, PlayCircle, PauseCircle, RefreshCcw, List, Check, Database, Film, ArrowRight, RotateCcw, SkipForward, Languages, Rewind, FastForward, Captions, ExternalLink } from "lucide-react";
import { getBestTorrentioStream } from "../lib/debrid";
import { PlaybackRequest, PlaybackCandidate } from "../types";
import { getTMDBExternalIds } from "../lib/tmdb";
import { getShow, resolveTVMazeShow } from "../lib/tvmaze";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { removeUndefined } from "../lib/library";
import { AudioTrackDescriptor, findEnglishAudioTrackIndex, hasOnlyKnownNonEnglishTracks } from "../lib/audioTracks";
import { findEnglishSubtitleTrackIndex, findPreferredSubtitleTrackIndex, isMeaningfulBackwardSeek } from "../lib/subtitleAssist";
import {
  fetchExternalEnglishSubtitle,
  getOpenSubtitlesApiKey,
  OpenSubtitlesError
} from "../lib/externalSubtitles";
import {
  CREDITS_AUTOPLAY_COUNTDOWN_SECONDS,
  shouldOfferNextEpisodeShortcut,
  shouldOfferUpNextChoices,
  shouldStartCreditsAutoplay
} from "../lib/autoplay";
import { optimizeArtworkUrl } from "../lib/images";
import {
  ExternalPlayerPlatform,
  getExternalPlayerLaunchUrl,
  selectPhonePlaybackCandidates,
  selectVlcFallbackCandidates
} from "../lib/phonePlayback";
import {
  findActiveIntroDBSegment,
  getIntroDBSegments,
  IntroDBSegments,
  IntroDBSegmentType
} from "../lib/introdb";
import {
  clearPlaybackProgress,
  getResumePosition,
  getSameSessionFailoverPosition,
  readPlaybackProgress,
  writePlaybackProgress
} from "../lib/playbackProgress";

const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatPlaybackTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

function StreamBadges({ cand }: { cand: PlaybackCandidate }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {cand.provider && (
        <span className="bg-purple-500/15 text-purple-300 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-500/20">
          ⚙️ {cand.provider}
        </span>
      )}
      {cand.readiness === 'cached' && (
        <span className="bg-blue-500/15 text-blue-300 font-bold text-[10px] px-2 py-0.5 rounded border border-blue-500/20">
          ⚡ Cached
        </span>
      )}
      {cand.readiness === 'uncached' && (
        <span className="bg-red-500/15 text-red-300 font-bold text-[10px] px-2 py-0.5 rounded border border-red-500/20">
          ⏳ Uncached
        </span>
      )}
      {cand.seeders !== undefined && (
        <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-500/20">
          👤 {cand.seeders} seeds
        </span>
      )}
      {cand.playbackSupport === "external" ? (
        <span className="bg-orange-500/15 text-orange-200 font-bold text-[10px] px-2 py-0.5 rounded border border-orange-500/25">
          VLC
        </span>
      ) : cand.playbackSupport === "probe" ? (
        <span className="bg-amber-500/15 text-amber-200 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-500/25">
          Phone test
        </span>
      ) : (
        <span className="bg-green-500/20 text-green-300 font-bold text-[10px] px-2 py-0.5 rounded border border-green-500/20">
          Phone ready
        </span>
      )}
      {cand.mediaContainer && (
        <span className="bg-cyan-500/15 text-cyan-200 font-bold text-[10px] px-2 py-0.5 rounded border border-cyan-500/25 uppercase">
          {cand.mediaContainer}
        </span>
      )}
      {cand.videoCodec && (
        <span className="bg-white/10 text-white/80 font-bold text-[10px] px-2 py-0.5 rounded border border-white/5 uppercase">
          {cand.videoCodec}
        </span>
      )}
      {cand.quality && (
        <span className="bg-white/10 text-white/80 font-bold text-[10px] px-2 py-0.5 rounded border border-white/5">
          {cand.quality}
        </span>
      )}
      {cand.audioLanguage === "english" && (
        <span className="bg-emerald-500/15 text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-500/25">
          English audio
        </span>
      )}
      {cand.audioLanguage === "multi" && (
        <span className="bg-cyan-500/15 text-cyan-200 font-bold text-[10px] px-2 py-0.5 rounded border border-cyan-500/25">
          Multi audio
        </span>
      )}
      {cand.sizeBytes && (
        <span className="bg-slate-800/80 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700">
          {formatBytes(cand.sizeBytes)}
        </span>
      )}
    </div>
  );
}

function PlaybackLoadingHero({ request, statusText }: { request: PlaybackRequest; statusText: string }) {
  const artwork = request.backdropUrl || request.episodeImageUrl || request.imageUrl;

  return (
    <div className="absolute inset-0 z-[90] bg-slate-950 overflow-hidden">
      {artwork ? (
        <img
          src={optimizeArtworkUrl(artwork)}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/35" />

      <div className="relative z-10 h-full max-w-5xl px-5 sm:px-12 md:px-20 py-8 sm:py-16 flex flex-col justify-end">
        <div className="flex items-center gap-3 mb-5">
          <span className="px-3 py-1.5 rounded-lg bg-orange-500 text-orange-950 text-xs font-extrabold uppercase tracking-wider">
            Preparing to play
          </span>
          {request.provider && request.provider !== "Unknown" && request.provider !== "Unknown Provider" && (
            <span className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs font-bold uppercase tracking-wider">
              {request.provider}
            </span>
          )}
        </div>
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold text-white tracking-tight leading-none mb-3 sm:mb-4 drop-shadow-lg">
          {request.showName}
        </h2>
        {!request.isMovie && (
          <p className="text-base sm:text-2xl text-slate-100 font-semibold mb-3 sm:mb-4 drop-shadow">
            Season {request.season}, Episode {request.number} · {request.episodeName}
          </p>
        )}
        {request.summary && (
          <p className="max-w-3xl text-sm sm:text-lg text-slate-300 leading-relaxed line-clamp-3 mb-5 sm:mb-8 drop-shadow">
            {request.summary}
          </p>
        )}

        <div
          tabIndex={0}
          data-tv-default-focus="true"
          aria-label={statusText}
          className="max-w-2xl rounded-2xl bg-black/65 border border-white/15 p-5"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-white text-lg font-bold">Finding the best iPhone source</p>
              <p className="text-slate-300 text-sm mt-1">{statusText}</p>
              {statusText.toLowerCase().includes("retrying") && (
                <p className="text-orange-200 text-xs mt-2">NextUp will try compatible backups automatically.</p>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface VideoPlayerModalProps {
  request: PlaybackRequest;
  nextRequest: PlaybackRequest | null;
  alternativeRequests: PlaybackRequest[];
  backRequestToken: number;
  onEpisodeComplete: () => void;
  onPlayNext: () => void;
  onPlayAlternative: (request: PlaybackRequest) => void;
  onClose: () => void;
}

type PlayerMode = 'loading' | 'playing' | 'vlc_fallback' | 'error';

interface WebOSAudioTrack extends AudioTrackDescriptor {
  enabled: boolean;
}

interface WebOSAudioTrackList {
  length: number;
  [index: number]: WebOSAudioTrack;
  item?: (index: number) => WebOSAudioTrack | null;
}

export function VideoPlayerModal({ request, nextRequest, alternativeRequests, backRequestToken, onEpisodeComplete, onPlayNext, onPlayAlternative, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playNextButtonRef = useRef<HTMLButtonElement>(null);
  const alternativeButtonRef = useRef<HTMLButtonElement>(null);
  const skipSegmentButtonRef = useRef<HTMLButtonElement>(null);
  const playbackToggleButtonRef = useRef<HTMLButtonElement>(null);
  const blockedAutoplayButtonRef = useRef<HTMLButtonElement>(null);
  const sourceSelectorOpenerRef = useRef<HTMLButtonElement>(null);
  const handledBackRequestRef = useRef(backRequestToken);
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const [candidates, setCandidates] = useState<PlaybackCandidate[]>([]);
  const [vlcCandidates, setVlcCandidates] = useState<PlaybackCandidate[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  
  const playableCandidates = candidates.filter(c =>
    c.container === 'web-compatible' || c.container === 'web-probe'
  );

  const [mode, setMode] = useState<PlayerMode>('loading');
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [showAllVlcSources, setShowAllVlcSources] = useState(false);
  
  const [statusText, setStatusText] = useState("Locating title...");
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  
  const [showUI, setShowUI] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMidstreamBuffering, setIsMidstreamBuffering] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [sourceValidated, setSourceValidated] = useState(false);
  const [resolutionAttempt, setResolutionAttempt] = useState(0);
  const [episodeEnded, setEpisodeEnded] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [creditsAutoplayCountdown, setCreditsAutoplayCountdown] = useState<number | null>(null);
  const [creditsAutoplayDismissed, setCreditsAutoplayDismissed] = useState(false);
  const [creditsAlternativesDismissed, setCreditsAlternativesDismissed] = useState(false);
  const [showCreditsNext, setShowCreditsNext] = useState(false);
  const [audioStatus, setAudioStatus] = useState("English audio preferred");
  const [subtitleStatus, setSubtitleStatus] = useState("Automatic subtitles ready");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [playbackClock, setPlaybackClock] = useState({ current: 0, duration: 0, playing: false });
  const [introDBSegments, setIntroDBSegments] = useState<IntroDBSegments>({});
  const [ignoredSegmentTypes, setIgnoredSegmentTypes] = useState<IntroDBSegmentType[]>([]);
  
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playAttemptedForSourceRef = useRef(false);
  const candidateAdvanceLockRef = useRef(false);
  const sourceValidatedRef = useRef(false);
  const startupDeadlineRef = useRef(0);
  const completionHandledRef = useRef(false);
  const lastClockSecondRef = useRef(-1);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const resumePositionRef = useRef(0);
  const sameSessionFailoverPositionRef = useRef<number | null>(null);
  const resumeAppliedForSourceRef = useRef(false);
  const lastProgressSaveSecondRef = useRef(-1);
  const subtitleRestoreModesRef = useRef<Array<{ track: TextTrack; mode: TextTrackMode }> | null>(null);
  const subtitleAssistTimerRef = useRef<number | null>(null);
  const subtitleRewindActiveRef = useRef(false);
  const subtitleMuteActiveRef = useRef(false);
  const captionsEnabledRef = useRef(false);
  const resolvedImdbIdRef = useRef<string | null>(null);
  const externalSubtitleTrackRef = useRef<HTMLTrackElement | null>(null);
  const externalSubtitleUrlRef = useRef<string | null>(null);
  const externalSubtitleAbortRef = useRef<AbortController | null>(null);
  const externalSubtitleLookupKeyRef = useRef("");
  const externalSubtitleLookupStateRef = useRef<"idle" | "loading" | "ready" | "unavailable">("idle");

  // Mutable refs to eliminate stale closure issues in timers & event handlers
  const playableCandidatesRef = useRef<PlaybackCandidate[]>([]);
  const vlcCandidatesRef = useRef<PlaybackCandidate[]>([]);
  const candidateIndexRef = useRef<number>(0);
  const modeRef = useRef<PlayerMode>('loading');

  useEffect(() => {
    playableCandidatesRef.current = playableCandidates;
  }, [candidates]);
  useEffect(() => {
    vlcCandidatesRef.current = vlcCandidates;
  }, [vlcCandidates]);
  useEffect(() => { candidateIndexRef.current = candidateIndex; }, [candidateIndex]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  const persistPlaybackProgress = useCallback((force = false) => {
    const userId = auth.currentUser?.uid;
    const video = videoRef.current;
    if (!userId || !video || !sourceValidatedRef.current) return;

    const position = video.currentTime;
    const duration = video.duration;
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0) return;

    if (duration - position <= 1) {
      try {
        clearPlaybackProgress(window.localStorage, userId, request.showId, request.episodeId);
      } catch {
        // The player still works when private storage is unavailable.
      }
      resumePositionRef.current = 0;
      lastProgressSaveSecondRef.current = -1;
      return;
    }

    resumePositionRef.current = position;
    const wholeSecond = Math.floor(position);
    if (!force && lastProgressSaveSecondRef.current >= 0 && Math.abs(wholeSecond - lastProgressSaveSecondRef.current) < 5) {
      return;
    }

    try {
      if (writePlaybackProgress(window.localStorage, userId, request.showId, request.episodeId, position, duration)) {
        lastProgressSaveSecondRef.current = wholeSecond;
      }
    } catch {
      // The player still works when private storage is unavailable.
    }
  }, [request.episodeId, request.showId]);

  const clearCurrentPlaybackProgress = useCallback(() => {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        clearPlaybackProgress(window.localStorage, userId, request.showId, request.episodeId);
      } catch {
        // The player still works when private storage is unavailable.
      }
    }
    resumePositionRef.current = 0;
    lastProgressSaveSecondRef.current = -1;
  }, [request.episodeId, request.showId]);

  const applySavedProgress = useCallback((video: HTMLVideoElement) => {
    if (resumeAppliedForSourceRef.current) return;
    resumeAppliedForSourceRef.current = true;

    const failoverPosition = sameSessionFailoverPositionRef.current;
    sameSessionFailoverPositionRef.current = null;
    const target = failoverPosition === null
      ? getResumePosition({
          position: resumePositionRef.current,
          duration: video.duration,
          updatedAt: Date.now()
        }, video.duration)
      : getSameSessionFailoverPosition(failoverPosition, video.duration);
    if (target === null) return;

    try {
      video.currentTime = target;
      setPlaybackClock(current => ({
        ...current,
        current: target,
        duration: video.duration
      }));
      setStatusText(`Resuming from ${formatPlaybackTime(target)}...`);
    } catch {
      // A source that cannot seek will continue from the beginning.
    }
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowUI(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowUI(false);
      }
    }, 5000);
  }, []);

  const rememberSameSessionFailoverPosition = useCallback(() => {
    const position = videoRef.current?.currentTime;
    sameSessionFailoverPositionRef.current = Number.isFinite(position) && (position || 0) > 0
      ? Number(position)
      : null;
  }, []);

  const restoreSubtitleModesIfIdle = useCallback(() => {
    if (subtitleRewindActiveRef.current || subtitleMuteActiveRef.current) return;
    const snapshot = subtitleRestoreModesRef.current;
    subtitleRestoreModesRef.current = null;
    const video = videoRef.current;
    const tracks = video ? Array.from(video.textTracks || []) : [];

    if (captionsEnabledRef.current && tracks.length > 0) {
      const preferredIndex = findPreferredSubtitleTrackIndex(tracks.map(track => ({
        kind: track.kind,
        language: track.language,
        label: track.label
      })));
      tracks.forEach((track, index) => {
        try {
          track.mode = index === preferredIndex ? "showing" : "disabled";
        } catch {
          // Some embedded tracks become unavailable when a source changes.
        }
      });
      setSubtitleStatus("Captions on");
      return;
    }

    if (snapshot) {
      snapshot.forEach(({ track, mode }) => {
        try {
          track.mode = mode;
        } catch {
          // Some embedded tracks become unavailable when a source changes.
        }
      });
    }
    setSubtitleStatus(externalSubtitleTrackRef.current ? "English captions ready" : "Automatic subtitles ready");
  }, []);

  const resetSubtitleAssist = useCallback(() => {
    if (subtitleAssistTimerRef.current !== null) {
      window.clearTimeout(subtitleAssistTimerRef.current);
      subtitleAssistTimerRef.current = null;
    }
    subtitleRewindActiveRef.current = false;
    subtitleMuteActiveRef.current = false;
    restoreSubtitleModesIfIdle();
  }, [restoreSubtitleModesIfIdle]);

  const enableSubtitleAssist = useCallback((reason: "rewind" | "mute") => {
    const video = videoRef.current;
    if (!video) return false;

    const tracks = Array.from(video.textTracks || []);
    const preferredIndex = findPreferredSubtitleTrackIndex(tracks.map(track => ({
      kind: track.kind,
      language: track.language,
      label: track.label
    })));
    if (preferredIndex < 0 || !tracks[preferredIndex]) {
      setSubtitleStatus("No subtitle track in this source");
      return false;
    }

    if (!subtitleRestoreModesRef.current) {
      subtitleRestoreModesRef.current = tracks.map(track => ({ track, mode: track.mode }));
    }
    tracks.forEach((track, index) => {
      try {
        track.mode = index === preferredIndex ? "showing" : "disabled";
      } catch {
        // Playback continues when a webOS source exposes a read-only track.
      }
    });

    if (reason === "mute") {
      subtitleMuteActiveRef.current = true;
      setSubtitleStatus("Subtitles on while muted");
      return true;
    }

    subtitleRewindActiveRef.current = true;
    setSubtitleStatus("Subtitles on after rewind");
    if (subtitleAssistTimerRef.current !== null) window.clearTimeout(subtitleAssistTimerRef.current);
    subtitleAssistTimerRef.current = window.setTimeout(() => {
      subtitleAssistTimerRef.current = null;
      subtitleRewindActiveRef.current = false;
      restoreSubtitleModesIfIdle();
    }, 15_000);
    return true;
  }, [restoreSubtitleModesIfIdle]);

  useEffect(() => () => resetSubtitleAssist(), [resetSubtitleAssist]);

  const currentStream = playableCandidates[candidateIndex]?.url;

  const openSourceSelector = useCallback(() => {
    setShowSourceSelector(true);
  }, []);

  const closeSourceSelector = useCallback((restoreFocus = true) => {
    setShowSourceSelector(false);
    if (!restoreFocus) return;
    window.setTimeout(() => {
      if (modeRef.current === "playing" && sourceSelectorOpenerRef.current?.isConnected) {
        sourceSelectorOpenerRef.current.focus({ preventScroll: true });
      }
    }, 80);
  }, []);

  const clearExternalSubtitle = useCallback(() => {
    externalSubtitleAbortRef.current?.abort();
    externalSubtitleAbortRef.current = null;
    externalSubtitleLookupKeyRef.current = "";
    externalSubtitleLookupStateRef.current = "idle";

    const track = externalSubtitleTrackRef.current;
    externalSubtitleTrackRef.current = null;
    if (track?.parentNode) track.parentNode.removeChild(track);

    const objectUrl = externalSubtitleUrlRef.current;
    externalSubtitleUrlRef.current = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, []);

  const loadOnlineCaptions = useCallback((video: HTMLVideoElement) => {
    const tracks = Array.from(video.textTracks || []);
    const descriptors = tracks.map(track => ({ kind: track.kind, language: track.language, label: track.label }));
    if (findEnglishSubtitleTrackIndex(descriptors) >= 0) {
      externalSubtitleLookupStateRef.current = "ready";
      setSubtitleStatus(captionsEnabledRef.current ? "Captions on" : "Automatic subtitles ready");
      return;
    }

    const apiKey = getOpenSubtitlesApiKey();
    const imdbId = resolvedImdbIdRef.current;
    if (!apiKey) {
      externalSubtitleLookupStateRef.current = "unavailable";
      subtitleRewindActiveRef.current = false;
      setSubtitleStatus("No English captions configured");
      return;
    }
    if (!imdbId || !currentStream) {
      externalSubtitleLookupStateRef.current = "unavailable";
      subtitleRewindActiveRef.current = false;
      setSubtitleStatus("No English captions available");
      return;
    }

    const candidate = playableCandidatesRef.current[candidateIndexRef.current];
    const lookupKey = [imdbId, request.season, request.number, candidate?.title || currentStream].join(":");
    if (externalSubtitleLookupKeyRef.current === lookupKey) {
      if (externalSubtitleLookupStateRef.current === "loading" && subtitleRewindActiveRef.current) {
        setSubtitleStatus("Finding English captions after rewind...");
      }
      return;
    }

    externalSubtitleAbortRef.current?.abort();
    const controller = new AbortController();
    externalSubtitleAbortRef.current = controller;
    externalSubtitleLookupKeyRef.current = lookupKey;
    externalSubtitleLookupStateRef.current = "loading";
    setSubtitleStatus("Finding English captions...");

    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    void fetchExternalEnglishSubtitle({
      imdbId,
      season: request.isMovie ? undefined : request.season,
      episode: request.isMovie ? undefined : request.number,
      releaseName: candidate?.title
    }, controller.signal).then(subtitle => {
      if (controller.signal.aborted || externalSubtitleLookupKeyRef.current !== lookupKey) return;
      if (!subtitle) {
        externalSubtitleLookupStateRef.current = "unavailable";
        subtitleRewindActiveRef.current = false;
        captionsEnabledRef.current = false;
        setCaptionsEnabled(false);
        setSubtitleStatus("No English captions found");
        return;
      }

      const objectUrl = URL.createObjectURL(new Blob([subtitle.vtt], { type: "text/vtt;charset=utf-8" }));
      const trackElement = document.createElement("track");
      trackElement.kind = "captions";
      trackElement.srclang = "en";
      trackElement.label = "English (OpenSubtitles)";
      trackElement.src = objectUrl;
      trackElement.default = false;
      externalSubtitleTrackRef.current = trackElement;
      externalSubtitleUrlRef.current = objectUrl;
      externalSubtitleLookupStateRef.current = "ready";

      const applyCaptionMode = () => {
        const showingForRewind = subtitleRewindActiveRef.current;
        const showingWhileMuted = subtitleMuteActiveRef.current;
        try {
          trackElement.track.mode = captionsEnabledRef.current || showingForRewind || showingWhileMuted
            ? "showing"
            : "disabled";
        } catch {
          // The track remains selectable even when webOS delays mode changes.
        }
        if (showingForRewind) {
          if (subtitleAssistTimerRef.current !== null) window.clearTimeout(subtitleAssistTimerRef.current);
          subtitleAssistTimerRef.current = window.setTimeout(() => {
            subtitleAssistTimerRef.current = null;
            subtitleRewindActiveRef.current = false;
            restoreSubtitleModesIfIdle();
          }, 15_000);
          setSubtitleStatus("Subtitles on after rewind");
        } else if (showingWhileMuted) {
          setSubtitleStatus("Subtitles on while muted");
        } else {
          setSubtitleStatus(captionsEnabledRef.current ? "Captions on" : "English captions ready");
        }
      };

      trackElement.addEventListener("load", applyCaptionMode, { once: true });
      video.appendChild(trackElement);
      applyCaptionMode();
    }).catch(error => {
      if (controller.signal.aborted || externalSubtitleLookupKeyRef.current !== lookupKey) {
        if (externalSubtitleLookupKeyRef.current === lookupKey) {
          externalSubtitleLookupStateRef.current = "unavailable";
          subtitleRewindActiveRef.current = false;
          captionsEnabledRef.current = false;
          setCaptionsEnabled(false);
          setSubtitleStatus("English captions unavailable");
        }
        return;
      }
      externalSubtitleLookupStateRef.current = "unavailable";
      subtitleRewindActiveRef.current = false;
      captionsEnabledRef.current = false;
      setCaptionsEnabled(false);
      if (error instanceof OpenSubtitlesError && (error.status === 406 || error.status === 429)) {
        setSubtitleStatus("Subtitle daily limit reached");
      } else if (error instanceof OpenSubtitlesError && (error.status === 401 || error.status === 403)) {
        setSubtitleStatus("Check OpenSubtitles key in Settings");
      } else {
        setSubtitleStatus("English captions unavailable");
      }
    }).finally(() => {
      window.clearTimeout(timeout);
      if (externalSubtitleAbortRef.current === controller) externalSubtitleAbortRef.current = null;
    });
  }, [currentStream, request.isMovie, request.number, request.season, restoreSubtitleModesIfIdle]);

  const activateSubtitleAssist = useCallback((reason: "rewind" | "mute") => {
    const video = videoRef.current;
    if (!video) return false;
    if (enableSubtitleAssist(reason)) return true;

    if (!getOpenSubtitlesApiKey() || externalSubtitleLookupStateRef.current === "unavailable") return false;
    if (reason === "rewind") {
      subtitleRewindActiveRef.current = true;
      setSubtitleStatus("Finding English captions after rewind...");
    } else {
      subtitleMuteActiveRef.current = true;
      setSubtitleStatus("Finding English captions while muted...");
    }
    loadOnlineCaptions(video);
    return true;
  }, [enableSubtitleAssist, loadOnlineCaptions]);

  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = Array.from(video.textTracks || []);
    const englishIndex = findEnglishSubtitleTrackIndex(tracks.map(track => ({
      kind: track.kind,
      language: track.language,
      label: track.label
    })));

    if (captionsEnabledRef.current) {
      tracks.forEach(track => {
        try { track.mode = "disabled"; } catch { /* Keep playback responsive. */ }
      });
      captionsEnabledRef.current = false;
      setCaptionsEnabled(false);
      subtitleRestoreModesRef.current = null;
      setSubtitleStatus("Captions off");
      return;
    }

    if (englishIndex < 0) {
      if (getOpenSubtitlesApiKey()) {
        captionsEnabledRef.current = true;
        setCaptionsEnabled(true);
        setSubtitleStatus("Captions will turn on when ready");
        externalSubtitleLookupKeyRef.current = "";
        loadOnlineCaptions(video);
      } else {
        setSubtitleStatus("Add OpenSubtitles key in Settings");
      }
      return;
    }

    if (subtitleAssistTimerRef.current !== null) {
      window.clearTimeout(subtitleAssistTimerRef.current);
      subtitleAssistTimerRef.current = null;
    }
    subtitleRewindActiveRef.current = false;
    subtitleMuteActiveRef.current = false;
    subtitleRestoreModesRef.current = null;
    tracks.forEach((track, index) => {
      try { track.mode = index === englishIndex ? "showing" : "disabled"; } catch { /* Keep playback responsive. */ }
    });
    captionsEnabledRef.current = true;
    setCaptionsEnabled(true);
    setSubtitleStatus("Captions on");
  }, [loadOnlineCaptions]);

  useEffect(() => {
    clearExternalSubtitle();
    return clearExternalSubtitle;
  }, [clearExternalSubtitle, currentStream]);

  const selectCandidate = (index: number) => {
    const selected = playableCandidates[index];
    if (!selected) return;

    rememberSameSessionFailoverPosition();
    persistPlaybackProgress(true);
    resetSubtitleAssist();
    const isSameSource = index === candidateIndexRef.current;
    candidateAdvanceLockRef.current = false;
    playAttemptedForSourceRef.current = false;
    sourceValidatedRef.current = false;
    resumeAppliedForSourceRef.current = false;
    startupDeadlineRef.current = Date.now() + 30_000;
    setSourceValidated(false);
    setAutoplayBlocked(false);
    setCandidateIndex(index);
    candidateIndexRef.current = index;
    setMode('playing');
    modeRef.current = 'playing';
    setPlaybackError(null);
    setIsLoading(true);
    setIsMidstreamBuffering(false);
    setStatusText(`Checking chosen ${selected.mediaContainer?.toUpperCase() || "phone"} source...`);
    closeSourceSelector(false);

    if (isSameSource && videoRef.current) {
      window.setTimeout(() => videoRef.current?.load(), 0);
    }
  };

  const openInExternalPlayer = useCallback((directStreamUrl: string) => {
    const platform: ExternalPlayerPlatform = isIOS
      ? "ios"
      : /Android/i.test(navigator.userAgent)
        ? "android"
        : "desktop";
    const launchUrl = getExternalPlayerLaunchUrl(directStreamUrl, platform);

    if (platform === "desktop") {
      window.open(launchUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Custom player schemes must be opened synchronously from the user's tap.
    window.location.href = launchUrl;
  }, [isIOS]);

  const showVlcFallback = useCallback((message: string) => {
    if (vlcCandidatesRef.current.length === 0) return false;
    setShowAllVlcSources(false);
    setMode('vlc_fallback');
    modeRef.current = 'vlc_fallback';
    setPlaybackError(message);
    setIsLoading(false);
    setIsMidstreamBuffering(false);
    setAutoplayBlocked(false);
    return true;
  }, []);


  const handleNextCandidate = useCallback((manual = false) => {
    // Several media events can fire for the same failure. Only advance once.
    if (candidateAdvanceLockRef.current) return;
    candidateAdvanceLockRef.current = true;

    rememberSameSessionFailoverPosition();
    persistPlaybackProgress(true);
    resetSubtitleAssist();
    setIsMidstreamBuffering(false);

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore browsers that reject pause during a source transition.
      }
    }

    playAttemptedForSourceRef.current = false;
    sourceValidatedRef.current = false;
    resumeAppliedForSourceRef.current = false;
    setSourceValidated(false);
    setAutoplayBlocked(false);

    const currentSources = playableCandidatesRef.current;
    const currentIndex = candidateIndexRef.current;

    const resetAttemptState = () => {
      setPlaybackError(null);
      setIsLoading(true);
    };

    if (!manual && startupDeadlineRef.current !== 0 && Date.now() > startupDeadlineRef.current) {
      if (showVlcFallback("NextUp tried the phone-ready sources, but none started in the browser.")) return;
      setMode('error');
      modeRef.current = 'error';
      setPlaybackError("Your phone tried the best direct sources, but none started in time.");
      setIsLoading(false);
      return;
    }

    if (currentIndex + 1 < currentSources.length) {
      const nextIdx = currentIndex + 1;
      setCandidateIndex(nextIdx);
      candidateIndexRef.current = nextIdx;
      resetAttemptState();
      setAutoplayBlocked(false);
      setStatusText(`Checking source ${nextIdx + 1} of ${currentSources.length}...`);
    } else if (manual && currentSources.length > 0) {
      const nextIdx = currentSources.length > 1 ? 0 : currentIndex;
      setCandidateIndex(nextIdx);
      candidateIndexRef.current = nextIdx;
      resetAttemptState();
      setAutoplayBlocked(false);
      setStatusText("Checking video source...");

      // A one-source retry does not change React's src prop, so reload it explicitly.
      if (nextIdx === currentIndex && videoRef.current) {
        window.setTimeout(() => {
          candidateAdvanceLockRef.current = false;
          try {
            videoRef.current?.load();
          } catch {
            // Ignore and let the normal media error path handle it.
          }
        }, 0);
      }
    } else {
      if (showVlcFallback("Every phone-ready source was tried before offering these MKV files.")) return;
      setMode('error');
      modeRef.current = 'error';
      setPlaybackError("Every phone-ready source was tried. Please refresh the source search.");
      setIsLoading(false);
    }
  }, [persistPlaybackProgress, rememberSameSessionFailoverPosition, resetSubtitleAssist, showVlcFallback]);

  /**
   * Real-Debrid can occasionally return a short placeholder video stating that
   * the requested file was removed. Keep every source hidden until its duration
   * proves it is a real movie or episode, then reveal it to the user.
   */
  const validateCurrentSource = useCallback((video: HTMLVideoElement): 'valid' | 'invalid' | 'pending' => {
    const duration = video.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      return 'pending';
    }

    // A normal movie or TV episode will never be a 30-second clip.
    // Allow a little margin because placeholder duration can vary by browser.
    if (duration <= 45) {
      sourceValidatedRef.current = false;
      setSourceValidated(false);
      setAutoplayBlocked(false);
      setIsLoading(true);
      setStatusText("Skipping an unavailable source...");

      // Defer the source change until the current media event finishes.
      window.setTimeout(() => handleNextCandidate(), 0);
      return 'invalid';
    }

    sourceValidatedRef.current = true;
    setSourceValidated(true);

    if (isIOS) {
      setAutoplayBlocked(true);
      setIsLoading(false);
      setStatusText("Video is ready. Tap play to begin.");
    }

    return 'valid';
  }, [handleNextCandidate, isIOS]);

  const ensureEnglishAudio = useCallback((video: HTMLVideoElement): boolean => {
    const audioTracks = (video as HTMLVideoElement & { audioTracks?: WebOSAudioTrackList }).audioTracks;
    const candidate = playableCandidatesRef.current[candidateIndexRef.current];

    if (!audioTracks || audioTracks.length === 0) {
      setAudioStatus(candidate?.audioLanguage === "english" ? "English audio" : "English audio preferred");
      return true;
    }

    const mutableTracks: WebOSAudioTrack[] = [];
    for (let index = 0; index < audioTracks.length; index++) {
      const track = audioTracks[index] || audioTracks.item?.(index);
      if (track) mutableTracks.push(track);
    }

    const descriptors = mutableTracks.map(track => ({
      language: track.language,
      label: track.label,
      kind: track.kind
    }));
    const englishIndex = findEnglishAudioTrackIndex(descriptors);

    if (englishIndex >= 0) {
      try {
        mutableTracks.forEach((track, index) => {
          track.enabled = index === englishIndex;
        });
        setAudioStatus("English audio selected");
      } catch {
        setAudioStatus("English audio preferred");
      }
      return true;
    }

    if (hasOnlyKnownNonEnglishTracks(descriptors)) {
      setIsLoading(true);
      setStatusText("Skipping a source without English audio...");
      window.setTimeout(() => handleNextCandidate(), 0);
      return false;
    }

    setAudioStatus(candidate?.audioLanguage === "english" ? "English audio" : "English audio preferred");
    return true;
  }, [handleNextCandidate]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setMode('loading');
    resetSubtitleAssist();
    modeRef.current = 'loading';
    setCandidates([]);
    playableCandidatesRef.current = [];
    setVlcCandidates([]);
    vlcCandidatesRef.current = [];
    setShowAllVlcSources(false);
    setCandidateIndex(0);
    candidateIndexRef.current = 0;
    setPlaybackError(null);
    setAutoplayBlocked(false);
    setSourceValidated(false);
    sourceValidatedRef.current = false;
    setIsLoading(true);
    setIsMidstreamBuffering(false);
    setEpisodeEnded(false);
    setAutoplayCountdown(null);
    setCreditsAutoplayCountdown(null);
    setCreditsAutoplayDismissed(false);
    setCreditsAlternativesDismissed(false);
    setShowCreditsNext(false);
    setAudioStatus("English audio preferred");
    setSubtitleStatus("Automatic subtitles ready");
    setPlaybackClock({ current: 0, duration: 0, playing: false });
    setIntroDBSegments({});
    setIgnoredSegmentTypes([]);
    setShowUI(true);
    lastClockSecondRef.current = -1;
    lastProgressSaveSecondRef.current = -1;
    resumeAppliedForSourceRef.current = false;
    resumePositionRef.current = 0;
    sameSessionFailoverPositionRef.current = null;
    completionHandledRef.current = false;
    candidateAdvanceLockRef.current = false;
    playAttemptedForSourceRef.current = false;
    resolvedImdbIdRef.current = null;

    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const savedProgress = readPlaybackProgress(
          window.localStorage,
          userId,
          request.showId,
          request.episodeId
        );
        resumePositionRef.current = getResumePosition(savedProgress) ?? 0;
      } catch {
        // The player still works when private storage is unavailable.
      }
    }
    
    async function resolveAndFetch() {
      try {
        let activeImdbId = request.imdbId && request.imdbId !== "none" ? request.imdbId : undefined;
        let resolvedTvmazeId = request.tvmazeId;
        
        if (!activeImdbId) {
          setStatusText("Locating title metadata...");
          if (request.isMovie) {
            const tmdbId = request._tmdbId || (resolvedTvmazeId && resolvedTvmazeId < 0 ? (-resolvedTvmazeId - 1000000000) : undefined);
            if (tmdbId) {
              try {
                const extIds = await getTMDBExternalIds(tmdbId, true);
                activeImdbId = extIds.imdb || undefined;
              } catch (e) {}
            }
          } else {
            if (resolvedTvmazeId && resolvedTvmazeId > 0) {
              try {
                const freshShow = await getShow(resolvedTvmazeId);
                activeImdbId = freshShow.externals?.imdb || undefined;
              } catch (e) {}
            }
            if (!activeImdbId) {
              const tmdbId = request._tmdbId || (resolvedTvmazeId && resolvedTvmazeId < 0 ? -resolvedTvmazeId : undefined);
              if (tmdbId) {
                try {
                  const extIds = await getTMDBExternalIds(tmdbId, false);
                  activeImdbId = extIds.imdb || undefined;
                } catch (e) {}
              }
            }
            if (!activeImdbId) {
              try {
                const resolved = await resolveTVMazeShow({
                  id: resolvedTvmazeId || -1,
                  name: request.showName,
                  _tmdbId: request._tmdbId,
                  isMovie: false
                } as any);
                if (resolved) {
                  if (resolved.id > 0) resolvedTvmazeId = resolved.id;
                  if (resolved.externals?.imdb) activeImdbId = resolved.externals.imdb;
                }
              } catch (e) {}
            }
          }

          // Backfill resolved IMDb ID and TVMaze ID to Firestore so existing library items stay fixed forever
          if (activeImdbId && auth.currentUser && request.showId) {
            try {
              const showRef = doc(db, `users/${auth.currentUser.uid}/shows/${request.showId}`);
              await setDoc(showRef, removeUndefined({
                imdbId: activeImdbId,
                ...(resolvedTvmazeId && resolvedTvmazeId > 0 ? { tvmazeId: resolvedTvmazeId } : {})
              }), { merge: true });
            } catch (e) {
              console.warn("Could not backfill resolved metadata to Firestore", e);
            }
          }
        }
        
        if (!active || !activeImdbId || activeImdbId === "none") {
          throw new Error("Unable to locate a valid IMDb ID for this title. Streams cannot be loaded.");
        }
        resolvedImdbIdRef.current = activeImdbId;

        if (!request.isMovie) {
          void getIntroDBSegments(activeImdbId, request.season, request.number, controller.signal)
            .then(segments => {
              if (active) setIntroDBSegments(segments);
            })
            .catch(error => {
              if (error instanceof DOMException && error.name === "AbortError") return;
              console.warn("IntroDB timestamps are unavailable for this episode", error);
            });
        }
        
        setStatusText("Finding sources...");
        const forceRefresh = resolutionAttempt > 0;
        const found = await getBestTorrentioStream(
          activeImdbId,
          request.season,
          request.number,
          request.isMovie ? 'movie' : 'series',
          controller.signal,
          forceRefresh,
          progress => {
            if (active) {
              setStatusText(`${progress.message} — retrying ${progress.attempt} of ${progress.maxAttempts}...`);
            }
          }
        );
        
        if (!active) return;
        
        if (found.length === 0) {
          throw new Error("No playable sources found.");
        }

        const compatibleSources = selectPhonePlaybackCandidates(found);
        const externalMkvSources = selectVlcFallbackCandidates(found);

        setCandidates(compatibleSources);
        playableCandidatesRef.current = compatibleSources;
        setVlcCandidates(externalMkvSources);
        vlcCandidatesRef.current = externalMkvSources;
        
        if (compatibleSources.length > 0) {
          setCandidateIndex(0);
          candidateIndexRef.current = 0;
          setMode('playing');
          modeRef.current = 'playing';
          startupDeadlineRef.current = Date.now() + 45_000;
          setAutoplayBlocked(false);
          setSourceValidated(false);
          sourceValidatedRef.current = false;
          setIsLoading(true);
          setStatusText(`Checking source 1 of ${compatibleSources.length}...`);
        } else if (externalMkvSources.length > 0) {
          setMode('vlc_fallback');
          modeRef.current = 'vlc_fallback';
          setPlaybackError("No browser-compatible source was found. These MKV files can be opened in VLC.");
          setIsLoading(false);
        } else {
          setMode('error');
          modeRef.current = 'error';
          setPlaybackError("No source matched this phone's supported video and audio formats.");
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!active) return;
        if (err.name === "AbortError") return;

        setPlaybackError(err.message);
        setMode('error');
        modeRef.current = 'error';
        setIsLoading(false);
      }
    }
    
    resolveAndFetch();
    
    return () => { 
      active = false; 
      controller.abort();
    };
  }, [request, resolutionAttempt, isIOS, resetSubtitleAssist]);

  const attemptPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    const validation = validateCurrentSource(video);
    if (validation !== 'valid') {
      if (validation === 'pending') {
        setAutoplayBlocked(false);
        setIsLoading(true);
        setStatusText("Checking video source...");
      }
      return;
    }

    applySavedProgress(video);

    try {
      setIsLoading(true);
      await video.play();
      setAutoplayBlocked(false);
      setIsLoading(false);
      setStatusText("Playing");
      showControlsTemporarily();
    } catch (error) {
      const pbError = error instanceof DOMException ? error : null;
      if (pbError?.name === "NotAllowedError") {
        setAutoplayBlocked(true);
        setIsLoading(false);
        return;
      }
      if (pbError?.name === "AbortError") {
        if (videoRef.current && videoRef.current.paused) {
          setIsLoading(false);
          setStatusText("Playback interrupted.");
          setAutoplayBlocked(true);
        }
        return;
      }
      setAutoplayBlocked(false);
      setIsLoading(false);
      handleNextCandidate();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void attemptPlayback();
    } else {
      video.pause();
    }
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const previousTime = video.currentTime;
    const targetTime = Math.min(video.duration, Math.max(0, previousTime + seconds));
    video.currentTime = targetTime;
    if (isMeaningfulBackwardSeek(previousTime, targetTime)) activateSubtitleAssist("rewind");
    setPlaybackClock(current => ({ ...current, current: video.currentTime, duration: video.duration }));
  };

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const previousTime = video.currentTime;
    const targetTime = Math.min(video.duration, Math.max(0, seconds));
    video.currentTime = targetTime;
    if (isMeaningfulBackwardSeek(previousTime, targetTime)) activateSubtitleAssist("rewind");
    setPlaybackClock(current => ({ ...current, current: video.currentTime, duration: video.duration }));
  };

  const handleEpisodeEnded = useCallback(() => {
    if (!sourceValidatedRef.current) return;

    clearCurrentPlaybackProgress();
    sourceValidatedRef.current = false;

    if (!completionHandledRef.current) {
      completionHandledRef.current = true;
      onEpisodeComplete();
    }

    setIsLoading(false);
    setAutoplayBlocked(false);
    setShowUI(true);
    setEpisodeEnded(true);
    setCreditsAutoplayCountdown(null);
    setAutoplayCountdown(nextRequest ? CREDITS_AUTOPLAY_COUNTDOWN_SECONDS : null);
    setPlaybackClock(current => ({ ...current, playing: false, current: current.duration || current.current }));
  }, [clearCurrentPlaybackProgress, nextRequest, onEpisodeComplete]);

  const startNextEpisode = useCallback(() => {
    if (!nextRequest) return;
    clearCurrentPlaybackProgress();
    sourceValidatedRef.current = false;
    if (!completionHandledRef.current) {
      completionHandledRef.current = true;
      onEpisodeComplete();
    }
    setEpisodeEnded(false);
    setAutoplayCountdown(null);
    setCreditsAutoplayCountdown(null);
    setShowCreditsNext(false);
    onPlayNext();
  }, [clearCurrentPlaybackProgress, nextRequest, onEpisodeComplete, onPlayNext]);

  const startAlternativeEpisode = useCallback((alternativeRequest: PlaybackRequest) => {
    clearCurrentPlaybackProgress();
    sourceValidatedRef.current = false;
    if (!completionHandledRef.current) {
      completionHandledRef.current = true;
      onEpisodeComplete();
    }
    setEpisodeEnded(false);
    setAutoplayCountdown(null);
    setCreditsAutoplayCountdown(null);
    setCreditsAlternativesDismissed(true);
    setShowCreditsNext(false);
    onPlayAlternative(alternativeRequest);
  }, [clearCurrentPlaybackProgress, onEpisodeComplete, onPlayAlternative]);

  const activeSkipSegment = findActiveIntroDBSegment(
    introDBSegments,
    playbackClock.current,
    playbackClock.duration,
    new Set(ignoredSegmentTypes)
  );

  const creditsWindowActive = sourceValidated
    && !episodeEnded
    && !autoplayBlocked
    && (activeSkipSegment?.type === "outro" || showCreditsNext)
    && shouldStartCreditsAutoplay(
      playbackClock.duration,
      playbackClock.current,
      Boolean(nextRequest),
      activeSkipSegment?.type === "outro"
    );

  const creditsAlternativesWindowActive = sourceValidated
    && !episodeEnded
    && !autoplayBlocked
    && !nextRequest
    && shouldOfferUpNextChoices(
      playbackClock.duration,
      playbackClock.current,
      alternativeRequests.length > 0,
      activeSkipSegment?.type === "outro"
    );

  useEffect(() => {
    if (!creditsWindowActive || creditsAutoplayDismissed) {
      if (!creditsWindowActive) {
        setCreditsAutoplayCountdown(current => current === null ? current : null);
      }
      return;
    }

    setCreditsAutoplayCountdown(current => current ?? CREDITS_AUTOPLAY_COUNTDOWN_SECONDS);
  }, [creditsAutoplayDismissed, creditsWindowActive]);

  useEffect(() => {
    if (
      !creditsWindowActive
      || creditsAutoplayDismissed
      || creditsAutoplayCountdown === null
      || !playbackClock.playing
    ) return;

    if (creditsAutoplayCountdown <= 0) {
      startNextEpisode();
      return;
    }

    const countdownTimer = window.setTimeout(
      () => setCreditsAutoplayCountdown(value => value === null ? null : value - 1),
      1000
    );
    return () => window.clearTimeout(countdownTimer);
  }, [creditsAutoplayCountdown, creditsAutoplayDismissed, creditsWindowActive, playbackClock.playing, startNextEpisode]);

  const continueWatchingCredits = useCallback(() => {
    setCreditsAutoplayDismissed(true);
    setCreditsAutoplayCountdown(null);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const dismissCreditsAlternatives = useCallback(() => {
    setCreditsAlternativesDismissed(true);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  useEffect(() => {
    if (!autoplayBlocked) return;
    const focusTimer = window.setTimeout(() => {
      blockedAutoplayButtonRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [autoplayBlocked]);

  // The LG remote's scroll-wheel click activates the focused element. Keep
  // initial player focus on Play/Pause so OK pauses instead of closing the video.
  useEffect(() => {
    if (mode !== 'playing' || !sourceValidated || autoplayBlocked || episodeEnded) return;

    const focusTimer = window.setTimeout(() => {
      playbackToggleButtonRef.current?.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(focusTimer);
  }, [autoplayBlocked, episodeEnded, mode, sourceValidated]);

  const skipActiveSegment = useCallback(() => {
    if (!activeSkipSegment) return;

    setIgnoredSegmentTypes(current => current.includes(activeSkipSegment.type)
      ? current
      : [...current, activeSkipSegment.type]
    );

    if (activeSkipSegment.type === "outro" && nextRequest) {
      startNextEpisode();
      return;
    }

    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const target = Math.min(video.duration, activeSkipSegment.endSeconds + 0.25);
    video.currentTime = target;
    setPlaybackClock(current => ({ ...current, current: target, duration: video.duration }));
  }, [activeSkipSegment, nextRequest, startNextEpisode]);

  useEffect(() => {
    const shouldFocusSkip = creditsWindowActive || Boolean(activeSkipSegment && activeSkipSegment.type !== "outro");
    if (!shouldFocusSkip) return;
    const focusTimer = window.setTimeout(() => skipSegmentButtonRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [activeSkipSegment?.endSeconds, activeSkipSegment?.type, creditsWindowActive]);

  useEffect(() => {
    if (!creditsAlternativesWindowActive || creditsAlternativesDismissed) return;
    const focusTimer = window.setTimeout(() => alternativeButtonRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [creditsAlternativesDismissed, creditsAlternativesWindowActive]);

  const replayCurrentEpisode = () => {
    const video = videoRef.current;
    if (!video) return;
    clearCurrentPlaybackProgress();
    resumeAppliedForSourceRef.current = true;
    setEpisodeEnded(false);
    setAutoplayCountdown(null);
    setCreditsAutoplayCountdown(null);
    setCreditsAutoplayDismissed(false);
    setCreditsAlternativesDismissed(false);
    video.currentTime = 0;
    void attemptPlayback();
  };

  const closePlayer = useCallback(() => {
    persistPlaybackProgress(true);
    onClose();
  }, [onClose, persistPlaybackProgress]);

  useEffect(() => {
    if (handledBackRequestRef.current === backRequestToken) return;
    handledBackRequestRef.current = backRequestToken;

    if (showSourceSelector) {
      closeSourceSelector();
      showControlsTemporarily();
      return;
    }

    if (creditsWindowActive && !creditsAutoplayDismissed) {
      continueWatchingCredits();
      window.setTimeout(() => playbackToggleButtonRef.current?.focus({ preventScroll: true }), 80);
      return;
    }

    if (creditsAlternativesWindowActive && !creditsAlternativesDismissed) {
      dismissCreditsAlternatives();
      window.setTimeout(() => playbackToggleButtonRef.current?.focus({ preventScroll: true }), 80);
      return;
    }

    closePlayer();
  }, [
    backRequestToken,
    closePlayer,
    closeSourceSelector,
    continueWatchingCredits,
    creditsAlternativesDismissed,
    creditsAlternativesWindowActive,
    creditsAutoplayDismissed,
    creditsWindowActive,
    dismissCreditsAlternatives,
    showControlsTemporarily,
    showSourceSelector
  ]);

  useEffect(() => {
    const saveProgress = () => persistPlaybackProgress(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveProgress();
    };

    window.addEventListener("pagehide", saveProgress);
    window.addEventListener("beforeunload", saveProgress);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveProgress();
      window.removeEventListener("pagehide", saveProgress);
      window.removeEventListener("beforeunload", saveProgress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistPlaybackProgress]);

  useEffect(() => {
    if (!episodeEnded) return;
    const focusTimer = window.setTimeout(() => {
      if (nextRequest) playNextButtonRef.current?.focus();
      else if (alternativeRequests.length > 0) alternativeButtonRef.current?.focus();
      else playNextButtonRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [alternativeRequests.length, episodeEnded, nextRequest]);

  useEffect(() => {
    if (!episodeEnded || !nextRequest || autoplayCountdown === null) return;
    if (autoplayCountdown <= 0) {
      startNextEpisode();
      return;
    }

    const countdownTimer = window.setTimeout(
      () => setAutoplayCountdown(value => value === null ? null : value - 1),
      1000
    );
    return () => window.clearTimeout(countdownTimer);
  }, [autoplayCountdown, episodeEnded, nextRequest, startNextEpisode]);

  const outroStart = introDBSegments.outro?.startSeconds;
  const hasUsableOutroTiming = typeof outroStart === "number" && (
    playbackClock.duration <= 0 || outroStart < playbackClock.duration
  );
  const shouldWarmNextSource = showCreditsNext || episodeEnded || Boolean(
    hasUsableOutroTiming && playbackClock.current >= Math.max(0, (outroStart || 0) - 180)
  );

  // Warm the source cache as the credits window approaches. Provider recovery
  // can take close to a minute, so waiting for the final eight-second countdown
  // is too late for seamless autoplay.
  useEffect(() => {
    if (!shouldWarmNextSource || !nextRequest?.imdbId) return;
    void getBestTorrentioStream(
      nextRequest.imdbId,
      nextRequest.season,
      nextRequest.number,
      nextRequest.isMovie ? "movie" : "series"
    ).catch(error => {
      console.warn("Could not preload the next episode", error);
    });
  }, [nextRequest?.imdbId, nextRequest?.isMovie, nextRequest?.number, nextRequest?.season, shouldWarmNextSource]);

  const mediaKeyActionsRef = useRef({ attemptPlayback, seekBy, togglePlayback });
  mediaKeyActionsRef.current = { attemptPlayback, seekBy, togglePlayback };

  useEffect(() => {
    const handleMediaKey = (event: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      const mediaActions = mediaKeyActionsRef.current;

      const keyCode = event.keyCode || event.which;
      if (event.key === "MediaPlayPause" || keyCode === 179) {
        event.preventDefault();
        event.stopPropagation();
        mediaActions.togglePlayback();
        return;
      }

      switch (keyCode) {
        case 415: // Play
          event.preventDefault();
          void mediaActions.attemptPlayback();
          break;
        case 19: // Pause
          event.preventDefault();
          video.pause();
          break;
        case 417: // Fast-forward
          event.preventDefault();
          mediaActions.seekBy(30);
          break;
        case 412: // Rewind
          event.preventDefault();
          mediaActions.seekBy(-15);
          break;
        case 413: // Stop
          event.preventDefault();
          video.pause();
          video.currentTime = 0;
          setShowUI(true);
          break;
      }
    };

    window.addEventListener("keydown", handleMediaKey);
    return () => window.removeEventListener("keydown", handleMediaKey);
  }, []);

  // Give each direct stream time to expose metadata while it remains hidden.
  useEffect(() => {
    if (mode !== 'playing' || !currentStream) return;

    candidateAdvanceLockRef.current = false;
    playAttemptedForSourceRef.current = false;
    sourceValidatedRef.current = false;
    resumeAppliedForSourceRef.current = false;
    setSourceValidated(false);
    setAutoplayBlocked(false);
    setIsLoading(true);
    setStatusText(`Checking source ${candidateIndexRef.current + 1} of ${playableCandidatesRef.current.length}...`);

    let timeoutDuration = candidateIndexRef.current === 0 ? 12_000 : 6_500;
    if (startupDeadlineRef.current !== 0) {
      const remainingBudget = startupDeadlineRef.current - Date.now();
      if (remainingBudget > 0 && remainingBudget < timeoutDuration) {
        timeoutDuration = remainingBudget;
      } else if (remainingBudget <= 0) {
        timeoutDuration = 0; // Trigger immediately
      }
    }
    const timeout = window.setTimeout(() => {
      if (modeRef.current !== 'playing' || sourceValidatedRef.current) return;

      const video = videoRef.current;
      if (video) {
        const validation = validateCurrentSource(video);
        if (validation !== 'pending') return;
      }

      handleNextCandidate();
    }, timeoutDuration);

    return () => window.clearTimeout(timeout);
  }, [currentStream, mode, handleNextCandidate, validateCurrentSource]);

  useEffect(() => {
    if (mode !== 'playing') return;
    const video = videoRef.current;
    if (!video) return;

    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWaiting = () => {
      if (video.paused || autoplayBlocked) return;

      // Only show spinner if video actually lacks sufficient buffer data
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        setIsLoading(true);
        if (sourceValidatedRef.current && video.currentTime > 0) {
          setIsMidstreamBuffering(true);
        }
      }

      if (stallTimer) clearTimeout(stallTimer);
      const stallDuration = candidateIndexRef.current === 0 ? 12_000 : 6_500;
      stallTimer = setTimeout(() => {
        if (
          modeRef.current === 'playing' &&
          !video.paused &&
          video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
        ) {
          handleNextCandidate();
        }
      }, stallDuration);
    };

    const handlePlaying = () => {
      if (!sourceValidatedRef.current) {
        const validation = validateCurrentSource(video);
        if (validation !== 'valid') {
          video.pause();
          return;
        }
      }

      applySavedProgress(video);

      setIsLoading(false);
      setIsMidstreamBuffering(false);
      setAutoplayBlocked(false);
      setStatusText("Playing");
      setPlaybackClock({
        current: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        playing: !video.paused
      });
      startupDeadlineRef.current = 0;
      if (stallTimer) clearTimeout(stallTimer);
    };

    const handleTimeUpdate = () => {
      const wholeSecond = Math.floor(video.currentTime || 0);
      if (wholeSecond !== lastClockSecondRef.current) {
        lastClockSecondRef.current = wholeSecond;
        setPlaybackClock({
          current: video.currentTime || 0,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          playing: !video.paused
        });
      }

      if (!video.paused && video.currentTime > 0) {
        if (!sourceValidatedRef.current) {
          const validation = validateCurrentSource(video);
          if (validation !== 'valid') {
            video.pause();
            return;
          }
        }
        setIsLoading(false);
        setIsMidstreamBuffering(false);
        setAutoplayBlocked(false);
        setStatusText("Playing");
        startupDeadlineRef.current = 0;
        if (stallTimer) clearTimeout(stallTimer);
        persistPlaybackProgress();

        const hasUsableIntroDBOutro = Boolean(
          introDBSegments.outro && introDBSegments.outro.startSeconds < video.duration
        );
        const shouldShowCreditsShortcut = !hasUsableIntroDBOutro && shouldOfferNextEpisodeShortcut(
          video.duration,
          video.currentTime,
          Boolean(nextRequest)
        );
        setShowCreditsNext(current => current === shouldShowCreditsShortcut ? current : shouldShowCreditsShortcut);
      }
    };

    const handleLoadStart = () => {
      if (!autoplayBlocked) setIsLoading(true);
    };

    const syncDetectedEnglishSubtitleTrack = () => {
      const subtitleTracks = Array.from(video.textTracks || []);
      const englishTrackIndex = findEnglishSubtitleTrackIndex(
        subtitleTracks.map(track => ({ kind: track.kind, language: track.language, label: track.label }))
      );
      if (englishTrackIndex < 0) return false;

      externalSubtitleLookupStateRef.current = "ready";
      if (captionsEnabledRef.current) {
        subtitleTracks.forEach((track, index) => {
          try {
            track.mode = index === englishTrackIndex ? "showing" : "disabled";
          } catch {
            // Some embedded tracks become writable shortly after metadata.
          }
        });
        setSubtitleStatus("Captions on");
      } else if (subtitleRewindActiveRef.current) {
        enableSubtitleAssist("rewind");
      } else if (subtitleMuteActiveRef.current) {
        enableSubtitleAssist("mute");
      } else {
        setSubtitleStatus("Automatic subtitles ready");
      }
      return true;
    };

    const handleLoadedMetadata = () => {
      const validation = validateCurrentSource(video);
      if (validation === 'valid') applySavedProgress(video);
      setPlaybackClock(current => ({
        ...current,
        current: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0
      }));
      if (validation === 'valid') ensureEnglishAudio(video);
      if (!syncDetectedEnglishSubtitleTrack() && validation === 'valid') {
        const captionsRequested = captionsEnabledRef.current
          || subtitleRewindActiveRef.current
          || subtitleMuteActiveRef.current;
        if (captionsRequested) {
          loadOnlineCaptions(video);
        } else {
          setSubtitleStatus("Automatic subtitles ready");
        }
      }
    };

    const handleVolumeChange = () => {
      const muted = video.muted || video.volume === 0;
      if (muted) {
        activateSubtitleAssist("mute");
        return;
      }
      subtitleMuteActiveRef.current = false;
      restoreSubtitleModesIfIdle();
    };

    const handlePause = () => {
      persistPlaybackProgress(true);
      setIsMidstreamBuffering(false);
      setShowUI(true);
      setPlaybackClock({
        current: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        playing: false
      });
    };

    const handleCanPlay = () => {
      const validation = validateCurrentSource(video);
      if (validation !== 'valid') return;
      applySavedProgress(video);
      if (!ensureEnglishAudio(video)) return;
      
      startupDeadlineRef.current = 0;

      if (isIOS) {
        setAutoplayBlocked(true);
        setIsLoading(false);
        setStatusText("Video is ready. Tap play to begin.");
        return;
      }

      setIsLoading(false);
      setIsMidstreamBuffering(false);
      if (!autoplayBlocked && !playAttemptedForSourceRef.current) {
        playAttemptedForSourceRef.current = true;
        void attemptPlayback();
      }
    };

    const handleVideoError = () => {
      setIsMidstreamBuffering(false);
      if (modeRef.current === 'playing') {
        handleNextCandidate();
      }
    };

    const handleSeeked = () => {
      persistPlaybackProgress(true);
      setPlaybackClock({
        current: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        playing: !video.paused
      });
      if (!video.paused) handlePlaying();
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('play', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('error', handleVideoError);
    video.textTracks?.addEventListener('addtrack', syncDetectedEnglishSubtitleTrack);

    return () => {
      if (stallTimer) clearTimeout(stallTimer);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('play', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('error', handleVideoError);
      video.textTracks?.removeEventListener('addtrack', syncDetectedEnglishSubtitleTrack);
    };
  }, [activateSubtitleAssist, applySavedProgress, currentStream, mode, autoplayBlocked, enableSubtitleAssist, ensureEnglishAudio, handleNextCandidate, introDBSegments.outro, isIOS, loadOnlineCaptions, nextRequest, persistPlaybackProgress, showControlsTemporarily, validateCurrentSource]);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      const previous = pointerPositionRef.current;
      if (!previous || Math.abs(event.clientX - previous.x) + Math.abs(event.clientY - previous.y) >= 14) {
        pointerPositionRef.current = { x: event.clientX, y: event.clientY };
        showControlsTemporarily();
      }
    };
    
    showControlsTemporarily();
    const events = ['mousedown', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, showControlsTemporarily));
    // TV navigation consumes D-pad keys during capture. Listen in the same phase
    // so the first directional press always wakes the controls and extends their
    // idle window even when navigation stops propagation afterward.
    window.addEventListener('keydown', showControlsTemporarily, true);
    window.addEventListener('mousemove', handlePointerMove);
    
    return () => {
      events.forEach(event => window.removeEventListener(event, showControlsTemporarily));
      window.removeEventListener('keydown', showControlsTemporarily, true);
      window.removeEventListener('mousemove', handlePointerMove);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [showControlsTemporarily]);

  const showCloseButton = showUI || mode === 'vlc_fallback' || mode === 'error' || isLoading || autoplayBlocked || episodeEnded;
  const nextEpisodeArtwork = optimizeArtworkUrl(
    nextRequest?.episodeImageUrl || nextRequest?.backdropUrl || nextRequest?.imageUrl
  );

  return (
    <div data-phone-player="true" className="fixed inset-0 z-[100] h-dvh overflow-hidden overscroll-none bg-slate-950 touch-manipulation" role="dialog" aria-modal="true" aria-label="Video player">
      {/* Always-on-top Close Button */}
      <div 
        aria-hidden={!showCloseButton}
        className={`absolute top-[calc(0.75rem+env(safe-area-inset-top))] sm:top-6 right-[calc(0.75rem+env(safe-area-inset-right))] sm:right-6 z-[200] transition-opacity duration-300 ${
          showCloseButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button 
          onClick={closePlayer}
          data-tv-ignore="true"
          tabIndex={-1}
          className="min-h-11 min-w-11 p-2.5 sm:p-3 bg-black/60 hover:bg-black/80 active:scale-95 rounded-full text-white transition-all shadow-lg border border-white/10"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* In-app phone player header overlay */}
      {mode === 'playing' && (
        <div aria-hidden={!showUI} className={`absolute inset-0 z-[101] pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
          <div data-phone-player-header="true" className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] sm:top-4 left-0 right-0 flex items-start justify-between pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(4.25rem+env(safe-area-inset-right))] sm:px-4 pointer-events-none">
            <div className="flex min-w-0 flex-col gap-1 pointer-events-auto mt-1 sm:mt-2 sm:ml-2">
              <h2 className="truncate text-white font-bold drop-shadow-md text-base sm:text-lg">{request.showName}</h2>
              {!request.isMovie && (
                <p className="truncate text-white/80 font-medium text-xs sm:text-sm drop-shadow-md">S{request.season} E{request.number}: {request.episodeName}</p>
              )}
              {currentStream && (
                <div data-phone-player-quick-actions="true" className="flex max-w-full items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 pointer-events-auto overflow-x-auto sm:flex-wrap scrollbar-none pb-1">
                  {playableCandidates.length > 1 && (
                    <button
                      onClick={() => handleNextCandidate(true)}
                      className="shrink-0 min-h-10 w-max px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 backdrop-blur-md border border-white/5"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Next source ({candidateIndex + 1}/{playableCandidates.length})
                    </button>
                  )}
                  <button
                    ref={sourceSelectorOpenerRef}
                    onClick={openSourceSelector}
                    className="shrink-0 min-h-10 w-max px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-full text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 backdrop-blur-md border border-white/10"
                  >
                    <List className="w-4 h-4" />
                    Phone sources ({playableCandidates.length})
                  </button>
                  {nextRequest && sourceValidated && (
                    <button
                      onClick={startNextEpisode}
                      className="shrink-0 min-h-10 w-max px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-400 text-orange-950 rounded-full text-xs sm:text-sm font-extrabold transition-colors flex items-center gap-2 shadow-lg"
                    >
                      <SkipForward className="w-4 h-4" />
                      Next episode
                    </button>
                  )}
                  <span className="hidden sm:flex w-max px-3 py-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 rounded-full text-sm font-semibold items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {audioStatus}
                  </span>
                  <span className="hidden sm:flex w-max px-3 py-2 bg-sky-500/15 border border-sky-500/25 text-sky-100 rounded-full text-sm font-semibold items-center gap-2">
                    <Captions className="w-4 h-4" />
                    {subtitleStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified player controls: top and bottom now share the same visibility state. */}
      {mode === 'playing' && sourceValidated && !autoplayBlocked && !episodeEnded && (
        <div
          aria-hidden={!showUI}
          data-tv-section="player-controls"
          data-phone-player-controls="true"
          className={`absolute left-0 right-0 bottom-0 z-[105] px-3 sm:px-8 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-7 pt-14 sm:pt-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
            showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="max-w-[1700px] mx-auto">
            <div className="flex items-center gap-2 sm:gap-4 mb-2.5 sm:mb-4">
              <span className="text-white text-[11px] sm:text-sm font-semibold tabular-nums min-w-[42px] sm:min-w-[70px] text-right">
                {formatPlaybackTime(playbackClock.current)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(playbackClock.duration, 1)}
                step={1}
                value={Math.min(playbackClock.current, Math.max(playbackClock.duration, 1))}
                onChange={event => seekTo(Number(event.currentTarget.value))}
                aria-label="Video progress"
                className="flex-1 min-w-0 accent-orange-500 cursor-pointer"
              />
              <span className="text-white text-[11px] sm:text-sm font-semibold tabular-nums min-w-[42px] sm:min-w-[70px]">
                {formatPlaybackTime(playbackClock.duration)}
              </span>
            </div>

            <div
              data-tv-row="true"
              data-phone-player-actions="true"
              className={`${nextRequest ? "grid grid-cols-5" : "grid grid-cols-4"} sm:flex items-center justify-center gap-2 sm:gap-4`}
            >
              <button
                onClick={() => seekBy(-15)}
                aria-label="Rewind 15 seconds"
                className="w-full sm:w-auto sm:flex-none min-w-0 sm:min-w-[150px] min-h-12 px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold flex items-center justify-center gap-2"
              >
                <Rewind className="w-5 h-5" />
                <span className="hidden sm:inline">15 sec</span>
              </button>
              <button
                ref={playbackToggleButtonRef}
                data-tv-default-focus="true"
                onClick={togglePlayback}
                className="w-full sm:w-auto sm:flex-none min-w-0 sm:min-w-[180px] min-h-12 px-2 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-orange-950 font-extrabold flex items-center justify-center gap-2"
              >
                {playbackClock.playing ? <PauseCircle className="w-6 h-6" /> : <PlayCircle className="w-6 h-6" />}
                <span className="hidden sm:inline">{playbackClock.playing ? "Pause" : "Play"}</span>
              </button>
              <button
                onClick={() => seekBy(30)}
                aria-label="Fast forward 30 seconds"
                className="w-full sm:w-auto sm:flex-none min-w-0 sm:min-w-[150px] min-h-12 px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold flex items-center justify-center gap-2"
              >
                <span className="hidden sm:inline">30 sec</span>
                <FastForward className="w-5 h-5" />
              </button>
              <button
                onClick={toggleCaptions}
                aria-pressed={captionsEnabled}
                className={`w-full sm:w-auto sm:flex-none min-w-0 sm:min-w-[170px] min-h-12 px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${
                  captionsEnabled
                    ? "bg-sky-400 border-sky-300 text-slate-950"
                    : "bg-white/10 hover:bg-white/20 border-white/15 text-white"
                }`}
              >
                <Captions className="w-5 h-5" />
                <span className="sm:hidden">CC</span>
                <span className="hidden sm:inline">{captionsEnabled ? "Captions on" : "Captions"}</span>
              </button>
              {nextRequest && (
                <button
                  onClick={startNextEpisode}
                    aria-label="Play next episode"
                    className="w-full sm:w-auto sm:flex-none min-w-0 sm:min-w-[210px] min-h-12 px-2 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold flex items-center justify-center gap-2"
                  >
                    <SkipForward className="w-6 h-6 text-orange-400" />
                    <span className="hidden sm:inline">Next episode</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE: Loading */}
      {mode === 'loading' && (
        <PlaybackLoadingHero request={request} statusText={statusText} />
      )}

      {/* MODE: In-app TV Player */}
      {mode === 'playing' && (
        <>
          {isLoading && !autoplayBlocked && (!videoRef.current || videoRef.current.paused || videoRef.current.currentTime === 0) && (
            <PlaybackLoadingHero request={request} statusText={statusText} />
          )}

          {isMidstreamBuffering && sourceValidated && !autoplayBlocked && !episodeEnded && (
            <div className="absolute inset-0 z-[96] pointer-events-none flex items-center justify-center" aria-hidden="true">
              <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin bg-black/20" />
            </div>
          )}

          {autoplayBlocked && (
            <div className="absolute inset-0 z-[90] flex items-center justify-center">
              <button 
                ref={blockedAutoplayButtonRef}
                data-tv-default-focus="true"
                onClick={attemptPlayback}
                className="flex flex-col items-center gap-4 bg-black/80 hover:bg-black/90 p-8 rounded-3xl backdrop-blur-sm transition-all border border-orange-500/20"
              >
                <PlayCircle className="w-16 h-16 text-orange-500" />
                <div className="text-center">
                  <p className="text-white font-semibold text-lg drop-shadow-md">Tap to Play</p>
                  <p className="text-white/60 text-xs mt-1">Your browser requires a tap before video with sound can start.</p>
                </div>
              </button>
            </div>
          )}

          {currentStream && (
            <video
              ref={videoRef}
              src={currentStream}
              tabIndex={0}
              playsInline
              preload={isIOS ? "metadata" : "auto"}
              aria-label={`Playing ${request.showName}`}
              onClick={togglePlayback}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  togglePlayback();
                }
              }}
              onPlay={() => {
                setIsLoading(false);
                setAutoplayBlocked(false);
              }}
              onPlaying={() => {
                setIsLoading(false);
                setAutoplayBlocked(false);
              }}
              onEnded={handleEpisodeEnded}
              aria-hidden={!sourceValidated}
              className={`absolute inset-0 w-full h-full object-contain z-[80] transition-opacity duration-200 ${
                sourceValidated ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </>
      )}

      {mode === 'playing' && sourceValidated && activeSkipSegment && activeSkipSegment.type !== "outro" && !episodeEnded && (
        <div data-phone-skip-card="true" className={`absolute left-3 right-3 sm:left-auto sm:right-8 z-[112] transition-[bottom] duration-300 ${showUI ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-44" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-10"}`}>
          <button
            ref={skipSegmentButtonRef}
            onClick={skipActiveSegment}
            className="w-full sm:w-auto min-w-0 sm:min-w-[320px] px-4 sm:px-6 py-3.5 sm:py-5 rounded-2xl bg-slate-950/95 border border-orange-500/70 text-left text-white flex items-center justify-between gap-4 sm:gap-5 shadow-2xl hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-orange-400 focus:ring-offset-2 sm:focus:ring-offset-4 focus:ring-offset-slate-950 transition-colors"
            aria-label={`Skip ${activeSkipSegment.type}`}
          >
            <div>
              <p className="text-orange-400 text-xs font-extrabold uppercase tracking-wider mb-1">
                {activeSkipSegment.type} detected
              </p>
              <p className="text-lg sm:text-xl font-bold">Skip {activeSkipSegment.type}</p>
            </div>
            <SkipForward className="w-9 h-9 text-orange-400 shrink-0" />
          </button>
        </div>
      )}

      {mode === 'playing' && !activeSkipSegment && showCreditsNext && !creditsWindowActive && nextRequest && !episodeEnded && (
        <div data-phone-skip-card="true" className={`absolute left-3 right-3 sm:left-auto sm:right-8 z-[110] transition-[bottom] duration-300 ${showUI ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-44" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-10"}`}>
          <button
            onClick={startNextEpisode}
            className="w-full sm:w-auto min-w-0 sm:min-w-[360px] px-4 sm:px-6 py-3.5 sm:py-5 rounded-2xl bg-slate-950/95 border border-orange-500/60 text-left text-white flex items-center justify-between gap-4 sm:gap-5 shadow-2xl hover:bg-slate-900 transition-colors"
            aria-label={`Skip credits and play season ${nextRequest.season} episode ${nextRequest.number}`}
          >
            <div>
              <p className="text-orange-400 text-xs font-extrabold uppercase tracking-wider mb-1">Skip credits</p>
              <p className="text-lg font-bold">Next episode</p>
              <p className="text-slate-300 text-sm mt-1">S{nextRequest.season} E{nextRequest.number} · {nextRequest.episodeName}</p>
            </div>
            <SkipForward className="w-9 h-9 text-orange-400 shrink-0" />
          </button>
        </div>
      )}

      {mode === 'playing' && creditsWindowActive && !creditsAutoplayDismissed && creditsAutoplayCountdown !== null && nextRequest && (
        <div
          data-phone-credits-card="true"
          className={`absolute left-3 right-3 sm:left-auto sm:right-8 z-[112] sm:w-[min(680px,calc(100vw-4rem))] transition-[bottom] duration-300 ${showUI ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-44" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-10"}`}
          role="status"
          aria-live="polite"
        >
          <div className="overflow-hidden rounded-2xl bg-slate-950/95 border border-orange-500/70 text-white shadow-2xl backdrop-blur-xl flex">
            <div className="relative hidden sm:block w-56 min-h-[190px] shrink-0 bg-slate-900 overflow-hidden">
              {nextEpisodeArtwork ? (
                <img
                  src={nextEpisodeArtwork}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
                  <Film className="w-14 h-14 text-slate-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/65" />
            </div>

            <div className="min-w-0 flex-1 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <p className="text-orange-400 text-xs font-extrabold uppercase tracking-[0.2em]">Up next</p>
                  <p className="text-white text-lg font-bold mt-1 truncate">
                    S{nextRequest.season} E{nextRequest.number} · {nextRequest.episodeName}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full border-4 border-orange-500/35 border-t-orange-400 flex items-center justify-center text-xl font-black text-white shrink-0">
                  {creditsAutoplayCountdown}
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-4">Playing automatically when the countdown ends.</p>

              <div data-tv-row="true" className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
                <button
                  ref={skipSegmentButtonRef}
                  data-tv-default-focus="true"
                  onClick={startNextEpisode}
                  className="min-w-0 min-h-[52px] px-3 sm:px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-orange-950 font-extrabold flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  <SkipForward className="w-5 h-5" />
                  <span className="truncate">Play now</span>
                </button>
                <button
                  onClick={continueWatchingCredits}
                  className="min-w-0 min-h-[52px] px-3 sm:px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold focus:outline-none focus:ring-4 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-950 truncate"
                >
                  Continue credits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'playing' && creditsAlternativesWindowActive && !creditsAlternativesDismissed && alternativeRequests.length > 0 && (
        <div
          data-tv-credits-up-next-shelf="true"
          data-phone-credits-alternatives="true"
          className={`absolute left-3 right-3 sm:left-8 sm:right-8 z-[112] max-h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom))] sm:max-h-none overflow-y-auto sm:overflow-visible overscroll-contain transition-[bottom] duration-300 ${showUI ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-44" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-10"}`}
          role="region"
          aria-label="Choose another Up Next episode"
        >
          <div className="max-w-[1500px] mx-auto rounded-2xl sm:rounded-3xl bg-slate-950/95 border border-orange-500/65 p-4 sm:p-5 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 mb-4">
              <div>
                <p className="text-orange-400 text-xs font-extrabold uppercase tracking-[0.2em]">What's next?</p>
                <h3 className="text-lg sm:text-2xl font-display font-bold mt-1">Choose another series from Up Next</h3>
                <p className="hidden sm:block text-slate-400 text-sm mt-1">There is no next released episode in this series. Nothing will autoplay.</p>
              </div>
              <button
                type="button"
                onClick={dismissCreditsAlternatives}
                className="shrink-0 min-h-11 sm:min-h-[56px] px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold focus:outline-none focus:ring-4 focus:ring-orange-400"
              >
                Continue credits
              </button>
            </div>

            <div data-tv-row="true" className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alternativeRequests.map((alternativeRequest, index) => {
                const artwork = optimizeArtworkUrl(
                  alternativeRequest.episodeImageUrl || alternativeRequest.backdropUrl || alternativeRequest.imageUrl
                );
                return (
                  <button
                    key={`${alternativeRequest.showId}:${alternativeRequest.episodeId}`}
                    ref={index === 0 ? alternativeButtonRef : undefined}
                    data-tv-default-focus={index === 0 ? "true" : undefined}
                    type="button"
                    onClick={() => startAlternativeEpisode(alternativeRequest)}
                    className="min-w-0 min-h-[96px] sm:min-h-[128px] overflow-hidden rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-left flex focus:outline-none focus:ring-4 focus:ring-orange-400 focus:border-orange-300"
                    aria-label={`Play ${alternativeRequest.showName}, season ${alternativeRequest.season} episode ${alternativeRequest.number}`}
                  >
                    <span className="relative w-20 sm:w-28 shrink-0 bg-slate-800 overflow-hidden self-stretch">
                      {artwork ? (
                        <img src={artwork} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center"><Film className="w-10 h-10 text-slate-500" /></span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 p-4 flex flex-col justify-center">
                      <span className="text-orange-400 text-xs font-extrabold uppercase tracking-wider">Up Next</span>
                      <span className="text-white text-lg font-bold truncate mt-1">{alternativeRequest.showName}</span>
                      <span className="text-slate-300 text-sm font-semibold mt-1">S{alternativeRequest.season} E{alternativeRequest.number}</span>
                      <span className="text-slate-400 text-sm truncate mt-1">{alternativeRequest.episodeName}</span>
                    </span>
                    <PlayCircle className="w-8 h-8 text-orange-400 shrink-0 self-center mr-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE: VLC fallback — reached only after browser playback is unavailable. */}
      {mode === 'vlc_fallback' && (
        <div
          data-phone-vlc-fallback="true"
          className="relative z-[102] h-dvh overflow-y-auto overscroll-contain px-4 sm:px-8 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        >
          <div className="w-full max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-orange-400" />
              </div>
              <p className="text-orange-400 text-xs font-extrabold uppercase tracking-[0.2em] mb-2">Browser fallback</p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">Open the MKV in VLC</h2>
              <p className="text-slate-300 text-sm sm:text-base mt-3 max-w-xl mx-auto leading-relaxed">
                {playbackError || "No compatible browser source could be played."} VLC can handle the remaining MKV options.
              </p>
              <p className="text-slate-500 text-xs mt-2">This screen appears only after phone-compatible sources are unavailable or fail.</p>
            </div>

            <div className="space-y-3">
              {(showAllVlcSources ? vlcCandidates : vlcCandidates.slice(0, 1)).map((candidate, index) => (
                <div
                  key={candidate.id || `vlc-source-${index}`}
                  className={`rounded-2xl border p-4 sm:p-5 bg-slate-900/90 ${index === 0 ? "border-orange-500/55" : "border-white/10"}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      {index === 0 && (
                        <span className="inline-flex mb-2 px-2 py-1 rounded-full bg-orange-500 text-orange-950 text-[10px] font-black uppercase tracking-wider">
                          Recommended
                        </span>
                      )}
                      <StreamBadges cand={candidate} />
                    </div>
                    <span className="shrink-0 text-xs font-mono text-slate-400">{formatBytes(candidate.sizeBytes)}</span>
                  </div>
                  <p className="text-white/90 text-xs sm:text-sm font-mono leading-relaxed break-all line-clamp-2 mb-4">
                    {candidate.title}
                  </p>
                  <button
                    type="button"
                    data-tv-default-focus={index === 0 ? "true" : undefined}
                    onClick={() => openInExternalPlayer(candidate.url)}
                    className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-[0.99] text-orange-950 font-extrabold flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-orange-300"
                  >
                    <PlayCircle className="w-5 h-5" />
                    {isIOS ? "Continue in VLC" : "Open externally"}
                  </button>
                </div>
              ))}
            </div>

            {vlcCandidates.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllVlcSources(show => !show)}
                className="w-full min-h-11 mt-3 px-4 py-2 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5"
              >
                {showAllVlcSources
                  ? "Show only the recommended VLC source"
                  : `Show ${vlcCandidates.length - 1} other VLC source${vlcCandidates.length === 2 ? "" : "s"}`}
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setResolutionAttempt(attempt => attempt + 1)}
                className="min-h-[52px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Search browser sources again
              </button>
              <button
                type="button"
                onClick={closePlayer}
                className="min-h-[52px] px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE: Error */}
      {mode === 'error' && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8 text-center max-w-md mx-auto relative z-[102]">
          <div className="w-16 h-16 bg-orange-500/15 text-orange-400 rounded-full flex items-center justify-center mb-2 border border-orange-500/25">
            <RefreshCcw className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Video couldn’t start</h2>
          <p className="text-gray-400 text-sm">
            {playbackError || "The video service did not return a usable source."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4 items-center justify-center">
            <button
              onClick={() => setResolutionAttempt(attempt => attempt + 1)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-slate-950 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={closePlayer}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Seamless next-episode handoff */}
      {episodeEnded && (
        <div data-phone-episode-ended="true" className="absolute inset-0 z-[210] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/95 backdrop-blur-lg px-4 sm:px-12 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]" role="status" aria-live="polite">
          <div className="w-full max-w-4xl min-h-full sm:min-h-0 text-center flex flex-col items-center justify-center py-4">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-emerald-500/15 border border-emerald-400/35 flex items-center justify-center mb-4 sm:mb-7">
              <Check className="w-7 h-7 sm:w-10 sm:h-10 text-emerald-400" />
            </div>
            <p className="text-orange-400 text-sm font-extrabold uppercase tracking-[0.24em] mb-3">Episode complete</p>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-3">{request.showName}</h2>

            {nextRequest ? (
              <>
                <p className="text-slate-400 text-lg mb-2">Up next</p>
                <p className="text-white text-xl sm:text-2xl md:text-3xl font-bold mb-2">
                  Season {nextRequest.season}, Episode {nextRequest.number}
                </p>
                <p className="text-slate-300 text-base sm:text-xl mb-5 sm:mb-7">{nextRequest.episodeName}</p>

                <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-8">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-full border-4 border-orange-500/35 border-t-orange-500 flex items-center justify-center text-xl sm:text-2xl font-black text-white">
                    {autoplayCountdown ?? 0}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-lg font-bold">Starting automatically</p>
                    <p className="text-slate-400 text-sm">The next episode is being prepared now.</p>
                  </div>
                </div>

                <div data-tv-row="true" className="flex w-full flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                  <button
                    ref={playNextButtonRef}
                    data-tv-default-focus="true"
                    onClick={startNextEpisode}
                    className="w-full sm:w-auto min-w-0 sm:min-w-[260px] min-h-[56px] sm:min-h-[72px] px-5 sm:px-9 py-3 sm:py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-orange-950 text-lg sm:text-xl font-extrabold flex items-center justify-center gap-3 transition-colors"
                  >
                    <PlayCircle className="w-8 h-8" />
                    Play next now
                  </button>
                  <button
                    onClick={closePlayer}
                    className="w-full sm:w-auto min-w-0 sm:min-w-[230px] min-h-[56px] sm:min-h-[72px] px-5 sm:px-8 py-3 sm:py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-base sm:text-lg font-bold flex items-center justify-center gap-3 transition-colors"
                  >
                    Exit to Up Next
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
                  {alternativeRequests.length > 0 ? "Choose another series" : "You're all caught up"}
                </h3>
                <p className="text-slate-400 text-sm sm:text-lg mb-5 sm:mb-6">
                  {alternativeRequests.length > 0
                    ? "There is no next released episode in this series. Pick another unwatched episode from Up Next."
                    : "There are no more released episodes in this series yet."}
                </p>

                {alternativeRequests.length > 0 && (
                  <div data-tv-row="true" className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-7">
                    {alternativeRequests.map((alternativeRequest, index) => {
                      const artwork = optimizeArtworkUrl(
                        alternativeRequest.episodeImageUrl || alternativeRequest.backdropUrl || alternativeRequest.imageUrl
                      );
                      return (
                        <button
                          key={`${alternativeRequest.showId}:${alternativeRequest.episodeId}`}
                          ref={index === 0 ? alternativeButtonRef : undefined}
                          data-tv-default-focus={index === 0 ? "true" : undefined}
                          type="button"
                          onClick={() => startAlternativeEpisode(alternativeRequest)}
                          className="min-w-0 min-h-[96px] sm:min-h-[128px] overflow-hidden rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-left flex focus:outline-none focus:ring-4 focus:ring-orange-400"
                          aria-label={`Play ${alternativeRequest.showName}, season ${alternativeRequest.season} episode ${alternativeRequest.number}`}
                        >
                          <span className="relative w-24 shrink-0 bg-slate-800 overflow-hidden self-stretch">
                            {artwork ? (
                              <img src={artwork} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center"><Film className="w-9 h-9 text-slate-500" /></span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 p-4 flex flex-col justify-center">
                            <span className="text-white text-lg font-bold truncate">{alternativeRequest.showName}</span>
                            <span className="text-orange-300 text-sm font-semibold mt-1">S{alternativeRequest.season} E{alternativeRequest.number}</span>
                            <span className="text-slate-400 text-sm truncate mt-1">{alternativeRequest.episodeName}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div data-tv-row="true" className="flex w-full flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                  <button
                    ref={alternativeRequests.length === 0 ? playNextButtonRef : undefined}
                    data-tv-default-focus={alternativeRequests.length === 0 ? "true" : undefined}
                    onClick={replayCurrentEpisode}
                    className="w-full sm:w-auto min-w-0 sm:min-w-[230px] min-h-[56px] sm:min-h-[72px] px-5 sm:px-8 py-3 sm:py-4 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-base sm:text-lg font-bold flex items-center justify-center gap-3 transition-colors"
                  >
                    <RotateCcw className="w-6 h-6" />
                    Replay episode
                  </button>
                  <button
                    onClick={closePlayer}
                    className="w-full sm:w-auto min-w-0 sm:min-w-[230px] min-h-[56px] sm:min-h-[72px] px-5 sm:px-8 py-3 sm:py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-orange-950 text-base sm:text-lg font-extrabold flex items-center justify-center gap-3 transition-colors"
                  >
                    Back to Up Next
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Ranked in-app source selector */}
      {showSourceSelector && (
        <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="absolute inset-0" onClick={() => closeSourceSelector()} />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Phone-ready sources"
            data-phone-source-selector="true"
            className="relative w-full max-w-md md:max-w-lg bg-slate-950 border-l border-white/10 h-dvh pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex flex-col shadow-2xl z-[230]"
          >
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-white text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  Phone-Ready Sources
                </h3>
                <p className="text-white/60 text-xs mt-1">
                  {playableCandidates.length} ranked source{playableCandidates.length === 1 ? "" : "s"} · MP4-first for mobile
                </p>
              </div>
              <button
                onClick={() => closeSourceSelector()}
                className="min-h-11 min-w-11 p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors flex items-center justify-center"
                aria-label="Close source list"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between text-xs font-bold text-green-400 mb-3">
                <span className="flex items-center gap-1.5">
                  <Film className="w-4 h-4" />
                  In-app playback
                </span>
                <span className="text-[10px] bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                  MP4 first · native phone formats
                </span>
              </div>

              <div className="space-y-2" data-tv-section="source-list">
                {playableCandidates.map((candidate, index) => {
                  const isActive = mode === 'playing' && index === candidateIndex;
                  return (
                    <button
                      key={candidate.id || `source-${index}`}
                      data-tv-default-focus={isActive ? "true" : undefined}
                      onClick={() => selectCandidate(index)}
                      className={`w-full text-left p-4 rounded-xl transition-all border flex flex-col gap-3 focus:outline-none focus:ring-4 focus:ring-orange-400 ${
                        isActive
                          ? 'bg-orange-500/15 border-orange-500/60'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15'
                      }`}
                      aria-label={`Play source ${index + 1}${candidate.quality ? `, ${candidate.quality}` : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <StreamBadges cand={candidate} />
                        <span className={`shrink-0 text-xs font-bold flex items-center gap-1 ${isActive ? "text-orange-400" : "text-white/70"}`}>
                          {isActive ? <Check className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                          {isActive ? "Playing" : "Play"}
                        </span>
                      </div>
                      <p className="text-white/90 text-xs font-mono leading-relaxed break-all line-clamp-2">
                        {candidate.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
