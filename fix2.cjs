const fs = require('fs');
let code = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

const regex = /const handlePlaying = \(\) => \{[\s\S]*?\};/;
const replacement = `
    const handlePlaying = () => {
      if (!video.paused && video.currentTime > 0) {
        if (!sourceValidatedRef.current) {
          const validation = validateCurrentSource(video);
          if (validation !== 'valid') {
            video.pause();
            return;
          }
        }
        setIsLoading(false);
        setAutoplayBlocked(false);
        setStatusText("Playing");
        startupDeadlineRef.current = 0;
        if (stallTimer) clearTimeout(stallTimer);
      }
    };
`;

code = code.replace(regex, replacement.trim());
fs.writeFileSync('src/components/VideoPlayerModal.tsx', code);
