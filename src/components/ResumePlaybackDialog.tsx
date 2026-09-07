import { useEffect, useRef } from "react";
import { PlayCircle, RotateCcw } from "lucide-react";
import { PlaybackRequest } from "../types";
import { formatPlaybackPosition } from "../lib/playbackProgress";

interface ResumePlaybackDialogProps {
  request: PlaybackRequest;
  resumePosition: number;
  onResume: () => void;
  onStartOver: () => void;
  onCancel: () => void;
}

export function ResumePlaybackDialog({
  request,
  resumePosition,
  onResume,
  onStartOver,
  onCancel
}: ResumePlaybackDialogProps) {
  const resumeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => resumeButtonRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const episodeLabel = request.isMovie
    ? "Movie"
    : `Season ${request.season}, Episode ${request.number}`;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/90 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Resume ${request.showName}`}
    >
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-8 text-center text-white">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-orange-400">Continue watching</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{request.showName}</h2>
        <p className="mt-2 text-base text-slate-300">{episodeLabel} · {request.episodeName}</p>

        <div data-tv-row="true" className="mt-8 flex flex-col gap-3">
          <button
            ref={resumeButtonRef}
            type="button"
            data-tv-default-focus="true"
            onClick={onResume}
            className="flex min-h-[56px] sm:min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-orange-500 px-4 sm:px-6 py-3 sm:py-4 text-lg sm:text-xl font-extrabold text-orange-950 hover:bg-orange-400"
          >
            <PlayCircle className="h-7 w-7" />
            Resume from {formatPlaybackPosition(resumePosition)}
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-lg font-bold text-white hover:bg-white/20"
          >
            <RotateCcw className="h-6 w-6" />
            Start Over
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[52px] w-full rounded-2xl px-6 py-3 text-base font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
