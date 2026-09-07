const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');

// Find the start of validateCurrentSource
let startIndex = lines.findIndex(l => l.includes('const validateCurrentSource = useCallback'));
let endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('const validation = validateCurrentSource(video);'));

console.log('startIndex:', startIndex, 'endIndex:', endIndex);

const fixedMiddle = `
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
      window.setTimeout(() => handleNextMp4Candidate(), 0);
      return 'invalid';
    }

    // English Audio Detection & Enforcement
    const audioTracks = (video as any).audioTracks;
    if (audioTracks && audioTracks.length > 0) {
      let englishTrackFound = false;
      let onlyForeignTracks = true;
      let englishTrackIndex = -1;

      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const lang = (track.language || '').toLowerCase();
        const label = (track.label || '').toLowerCase();
        
        const isEnglish = lang.includes('en') || label.includes('eng') || label.includes('english');
        // Match common torrent foreign tags
        const isForeign = /^(fr|it|es|de|ru|hi|ta|te|ja|ko|zh|pt|pl)$/.test(lang) || /fre|french|ita|spa|ger|rus|hin|tam|tel|jap|kor|chi|por|lat|pol|vostfr/.test(label);
        
        if (isEnglish) {
          englishTrackFound = true;
          englishTrackIndex = i;
          onlyForeignTracks = false;
        } else if (!isForeign && !lang && !label) {
          onlyForeignTracks = false; // Could be anything
        }
      }

      if (englishTrackFound) {
        // Force the English track
        for (let i = 0; i < audioTracks.length; i++) {
          audioTracks[i].enabled = (i === englishTrackIndex);
        }
      } else if (onlyForeignTracks && audioTracks.length > 0) {
        // Failsafe: reject known foreign-only sources
        sourceValidatedRef.current = false;
        setSourceValidated(false);
        setAutoplayBlocked(false);
        setIsLoading(true);
        setStatusText("Skipping a source without English audio...");
        window.setTimeout(() => handleNextMp4Candidate(), 0);
        return 'invalid';
      }
    }

    if (!sourceValidatedRef.current) {
      sourceValidatedRef.current = true;
      setSourceValidated(true);
    }
    return 'valid';
  }, [handleNextMp4Candidate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (mode !== 'mp4_play' || !currentMp4Stream) {
      return;
    }

    let stallTimer: number | null = null;

    const handleWaiting = () => {
      if (!autoplayBlocked) setIsLoading(true);
      stallTimer = window.setTimeout(() => {
        if (videoRef.current && videoRef.current.readyState < 3 && modeRef.current === 'mp4_play') {
          handleNextMp4Candidate();
        }
      }, 15000);
    };

    const handlePlaying = () => {
      if (!video.paused && video.currentTime > 0) {
        if (!sourceValidatedRef.current) {
`;

lines.splice(startIndex, endIndex - startIndex, fixedMiddle.trim());
fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
