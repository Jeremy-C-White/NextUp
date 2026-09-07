interface ProgressRingProps {
  percentage: number | null;
  size?: "small" | "medium";
  className?: string;
}

export function getProgressRingPositioningClass(className: string): string {
  return /(?:^|\s)(?:absolute|fixed|sticky)(?:\s|$)/.test(className) ? "" : "relative";
}

export function ProgressRing({ percentage, size = "medium", className = "" }: ProgressRingProps) {
  if (percentage === null || !Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) return null;

  const safePercentage = Math.max(1, Math.min(99, Math.round(percentage)));
  const dimensions = size === "small" ? "w-12 h-12" : "w-16 h-16";
  const ringSizeClass = `playback-progress-ring--${size}`;
  const positioningClass = getProgressRingPositioningClass(className);

  return (
    <div
      role="img"
      aria-label={`${safePercentage}% played`}
      className={`playback-progress-ring ${ringSizeClass} ${positioningClass} shrink-0 rounded-full bg-slate-950/90 border border-white/20 shadow-lg ${dimensions} ${className}`}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="#020617" stroke="rgb(51 65 85 / 92%)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="#fb923c"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${safePercentage} 100`}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-white font-extrabold tabular-nums">
        {safePercentage}%
      </span>
    </div>
  );
}
