import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { UserShow } from "../types";
import { markTvThemeUnavailable, readThemePreviewsEnabled, resolveTvThemeUrl } from "../lib/tvThemes";
import { forgetFallbackTheme, resolveFallbackTheme } from "../lib/themeMusic";
import { formatPlaybackDiagnostic } from "../lib/playbackDiagnostics";

const FOCUS_SETTLE_DELAY_MS = 500;
const FADE_IN_MS = 500;
const FADE_OUT_MS = 180;
const THEME_VOLUME = 0.22;

export type TvThemePlaybackStatus = "idle" | "loading" | "playing" | "blocked" | "unavailable";

export interface TvThemePlayerHandle {
  play: () => void;
}

export interface TvThemeTrackInfo {
  showId: string;
  source: "plex" | "deezer";
  title?: string;
  artist?: string;
  /** Deezer track id, used for "Not this song". */
  trackId?: number;
}

interface TvThemePlayerProps {
  show?: UserShow;
  enabled: boolean;
  onStatusChange: (status: TvThemePlaybackStatus) => void;
  onTrackChange?: (track: TvThemeTrackInfo | null) => void;
  /** Bump to re-resolve the current title's theme (after "Not this song"). */
  refreshToken?: number;
}

type ThemePlayResult = "playing" | "failed" | "blocked" | "cancelled";

export const TvThemePlayer = forwardRef<TvThemePlayerHandle, TvThemePlayerProps>(function TvThemePlayer(
  { show, enabled, onStatusChange, onTrackChange, refreshToken = 0 },
  ref
) {
  const onTrackChangeRef = useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;
  const audioRef = useRef<HTMLAudioElement>(null);
  const startTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const requestTokenRef = useRef(0);

  const clearStartTimer = () => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  };

  const clearFadeTimer = () => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const resetAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  const fadeOut = () => {
    clearFadeTimer();
    const audio = audioRef.current;
    if (!audio || audio.paused || audio.volume <= 0) {
      resetAudio();
      return;
    }

    const startingVolume = audio.volume;
    const startedAt = Date.now();
    fadeTimerRef.current = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / FADE_OUT_MS);
      audio.volume = Math.max(0, startingVolume * (1 - progress));
      if (progress >= 1) {
        clearFadeTimer();
        resetAudio();
      }
    }, 30);
  };

  const fadeIn = (token: number) => {
    clearFadeTimer();
    const audio = audioRef.current;
    if (!audio) return;

    const startedAt = Date.now();
    fadeTimerRef.current = window.setInterval(() => {
      if (token !== requestTokenRef.current) {
        clearFadeTimer();
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / FADE_IN_MS);
      audio.volume = Math.min(THEME_VOLUME, THEME_VOLUME * progress);
      if (progress >= 1) clearFadeTimer();
    }, 40);
  };

  const playThemeUrl = (url: string, token: number): Promise<ThemePlayResult> => new Promise(resolve => {
    const audio = audioRef.current;
    if (!audio || token !== requestTokenRef.current) {
      resolve("cancelled");
      return;
    }
    let settled = false;
    const settle = (result: ThemePlayResult) => {
      if (settled) return;
      settled = true;
      resolve(token === requestTokenRef.current ? result : "cancelled");
    };

    clearFadeTimer();
    audio.volume = 0;
    audio.preload = "auto";
    audio.src = url;
    audio.onended = () => {
      if (token === requestTokenRef.current) {
        onStatusChange("idle");
        onTrackChangeRef.current?.(null);
      }
    };
    audio.onerror = () => settle("failed");
    audio.play()
      .then(() => settle("playing"))
      .catch((error: unknown) => {
        const name = (error as { name?: string } | null)?.name;
        settle(name === "NotAllowedError" ? "blocked" : "failed");
      });
  });

  useImperativeHandle(ref, () => ({
    play: () => {
      const audio = audioRef.current;
      if (!audio || !enabled || !audio.src) return;
      const token = requestTokenRef.current;
      audio.volume = 0;
      void audio.play().then(() => {
        if (token !== requestTokenRef.current) return;
        onStatusChange("playing");
        fadeIn(token);
      }).catch(() => {
        if (token === requestTokenRef.current) onStatusChange("blocked");
      });
    }
  }));

  useEffect(() => {
    const token = ++requestTokenRef.current;
    clearStartTimer();
    fadeOut();
    onStatusChange("idle");
    onTrackChangeRef.current?.(null);

    if (!enabled || !show) return;

    startTimerRef.current = window.setTimeout(async () => {
      startTimerRef.current = null;
      if (token !== requestTokenRef.current) return;
      onStatusChange("loading");

      const startPlaying = (track: TvThemeTrackInfo) => {
        onStatusChange("playing");
        onTrackChangeRef.current?.(track);
        fadeIn(token);
        console.info(formatPlaybackDiagnostic("theme music", {
          source: track.source,
          show: show.name,
          title: track.title,
          artist: track.artist
        }));
      };

      // 1. Plex TV theme library (TV shows only, full-length themes).
      if (!show.isMovie) {
        const plexUrl = await resolveTvThemeUrl(show);
        if (token !== requestTokenRef.current) return;
        if (plexUrl) {
          const result = await playThemeUrl(plexUrl, token);
          if (result === "cancelled") return;
          if (result === "playing") {
            startPlaying({ showId: show.id, source: "plex" });
            return;
          }
          if (result === "blocked") {
            // iPhone Safari may require one explicit gesture. Keep this exact
            // resolved source loaded so the next normal screen touch can retry it.
            onStatusChange("blocked");
            return;
          }
          markTvThemeUnavailable(plexUrl);
        }
      }

      // 2. ThemerrDB pick + Deezer 30-second preview (movies, and shows Plex lacks).
      if (!readThemePreviewsEnabled()) {
        resetAudio();
        onStatusChange("unavailable");
        console.info(formatPlaybackDiagnostic("theme music unavailable", {
          show: show.name,
          why: "soundtrack-previews-off-in-settings"
        }));
        return;
      }
      let fallback = null;
      try {
        fallback = await resolveFallbackTheme(show);
      } catch {
        fallback = null;
      }
      if (token !== requestTokenRef.current) return;
      if (!fallback) {
        resetAudio();
        onStatusChange("unavailable");
        console.info(formatPlaybackDiagnostic("theme music unavailable", {
          show: show.name,
          why: show.isMovie ? "no-matching-soundtrack" : "no-plex-theme-or-matching-soundtrack"
        }));
        return;
      }

      const result = await playThemeUrl(fallback.track.previewUrl, token);
      if (result === "cancelled") return;
      if (result === "playing") {
        startPlaying({
          showId: show.id,
          source: "deezer",
          title: fallback.track.title,
          artist: fallback.track.artist,
          trackId: fallback.track.id
        });
        return;
      }
      // Deezer preview links are signed and expire: forget this lookup so the
      // next visit asks again instead of reusing a dead link.
      forgetFallbackTheme(show.id);
      if (result === "blocked") {
        // Preserve the signed Deezer preview URL for the next user gesture.
        onStatusChange("blocked");
      } else {
        resetAudio();
        onStatusChange("unavailable");
      }
    }, FOCUS_SETTLE_DELAY_MS);

    return () => {
      ++requestTokenRef.current;
      clearStartTimer();
      fadeOut();
    };
  }, [enabled, show?.id, show?.thetvdbId, show?.tvmazeId, show?._tmdbId, show?.isMovie, refreshToken, onStatusChange]);

  useEffect(() => () => {
    ++requestTokenRef.current;
    clearStartTimer();
    clearFadeTimer();
    resetAudio();
  }, []);

  return <audio ref={audioRef} aria-hidden="true" preload="none" playsInline />;
});
