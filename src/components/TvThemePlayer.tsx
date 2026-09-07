import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { UserShow } from "../types";
import { markTvThemeUnavailable, resolveTvThemeUrl } from "../lib/tvThemes";

const FOCUS_SETTLE_DELAY_MS = 500;
const FADE_IN_MS = 500;
const FADE_OUT_MS = 180;
const THEME_VOLUME = 0.22;

export type TvThemePlaybackStatus = "idle" | "loading" | "playing" | "blocked" | "unavailable";

export interface TvThemePlayerHandle {
  play: () => void;
}

interface TvThemePlayerProps {
  show?: UserShow;
  enabled: boolean;
  onStatusChange: (status: TvThemePlaybackStatus) => void;
}

export const TvThemePlayer = forwardRef<TvThemePlayerHandle, TvThemePlayerProps>(function TvThemePlayer(
  { show, enabled, onStatusChange },
  ref
) {
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

  useImperativeHandle(ref, () => ({
    play: () => {
      const audio = audioRef.current;
      if (!audio || !enabled || !audio.src) return;
      const token = requestTokenRef.current;
      audio.volume = 0;
      const attempt = audio.play();
      void Promise.resolve(attempt).then(() => {
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

    if (!enabled || !show || show.isMovie) return;

    startTimerRef.current = window.setTimeout(async () => {
      startTimerRef.current = null;
      if (token !== requestTokenRef.current) return;
      onStatusChange("loading");

      const themeUrl = await resolveTvThemeUrl(show);
      if (token !== requestTokenRef.current) return;
      if (!themeUrl) {
        onStatusChange("unavailable");
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      clearFadeTimer();
      audio.volume = 0;
      audio.preload = "auto";
      audio.src = themeUrl;
      audio.onended = () => {
        if (token === requestTokenRef.current) onStatusChange("idle");
      };
      audio.onerror = () => {
        markTvThemeUnavailable(themeUrl);
        if (token === requestTokenRef.current) onStatusChange("unavailable");
        resetAudio();
      };

      try {
        await audio.play();
        if (token !== requestTokenRef.current) {
          fadeOut();
          return;
        }
        onStatusChange("playing");
        fadeIn(token);
      } catch {
        // iPhone Safari commonly requires one explicit tap before allowing
        // audio. Keep the resolved theme loaded so the visible retry button
        // can start this exact media element inside the user's tap gesture.
        if (token === requestTokenRef.current) onStatusChange("blocked");
      }
    }, FOCUS_SETTLE_DELAY_MS);

    return () => {
      ++requestTokenRef.current;
      clearStartTimer();
      fadeOut();
    };
  }, [enabled, show?.id, show?.thetvdbId, show?.tvmazeId, show?._tmdbId, onStatusChange]);

  useEffect(() => () => {
    ++requestTokenRef.current;
    clearStartTimer();
    clearFadeTimer();
    resetAudio();
  }, []);

  return <audio ref={audioRef} aria-hidden="true" preload="none" playsInline />;
});
