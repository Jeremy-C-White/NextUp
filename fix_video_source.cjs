const fs = require('fs');
let code = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

code = code.replace(
  /import \{ X, PlayCircle, AlertCircle \} from "lucide-react";/,
  `import { X, PlayCircle, AlertCircle, RefreshCcw } from "lucide-react";`
);

code = code.replace(
  /const handleNextCandidate = \(\) => \{[\s\S]*?  \};/,
  `const handleNextCandidate = (manual = false) => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex(prev => prev + 1);
      setHasError(false);
      setPlaybackError(null);
      setPlaybackWarning(null);
      setIsLoading(true);
      setStatusText("Trying another source...");
    } else if (manual && candidates.length > 0) {
      setCandidateIndex(0);
      setHasError(false);
      setPlaybackError(null);
      setPlaybackWarning(null);
      setIsLoading(true);
      setStatusText("Trying another source...");
    } else {
      setHasError(true);
      setPlaybackError("All sources failed. VLC is recommended.");
      setIsLoading(false);
    }
  };`
);

code = code.replace(
  /\{streamUrl && \(\n\s*<button\n\s*onClick=\{\(\) => launchVLC\(streamUrl\)\}\n\s*className="mt-2 w-max px-4 py-2 bg-orange-500\/80 hover:bg-orange-500 text-slate-900 dark:text-white rounded-full text-sm font-semibold transition-colors flex items-center gap-2"\n\s*>\n\s*<PlayCircle className="w-4 h-4" \/>\n\s*\{vlcLabel\}\n\s*<\/button>\n\s*\)\}/,
  `{streamUrl && (
              <div className="flex items-center gap-3 mt-2 pointer-events-auto">
                <button
                  onClick={() => launchVLC(streamUrl)}
                  className="w-max px-4 py-2 bg-orange-500/80 hover:bg-orange-500 text-slate-900 dark:text-white rounded-full text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  {vlcLabel}
                </button>
                {candidates.length > 1 && (
                  <button
                    onClick={() => handleNextCandidate(true)}
                    className="w-max px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-semibold transition-colors flex items-center gap-2 backdrop-blur-md"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Change Source ({candidateIndex + 1}/{candidates.length})
                  </button>
                )}
              </div>
            )}`
);

// We should also replace calls to handleNextCandidate() that were passed without args
// to ensure it works properly, though default is false
code = code.replace(/onClick=\{handleNextCandidate\}/g, `onClick={() => handleNextCandidate(true)}`);

fs.writeFileSync('src/components/VideoPlayerModal.tsx', code);
