const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');
const attemptPlaybackCode = `
  const attemptPlayback = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setAutoplayBlocked(false);
      setIsLoading(false);
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setAutoplayBlocked(true);
        setStatusText("Video is ready. Tap play to begin.");
      } else {
        console.error("Playback failed", e);
      }
    }
  };
`;

const index = lines.findIndex(l => l.includes('useEffect(() => {') && lines[lines.indexOf(l)+1].includes('const video = videoRef.current;'));
lines.splice(index, 0, attemptPlaybackCode.trim());

fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
