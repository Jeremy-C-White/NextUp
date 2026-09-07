const fs = require('fs');
const content = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

const lines = content.split('\n');

const resolvePlaybackIndex = lines.findIndex(l => l.includes('async function resolvePlayback() {'));

if (resolvePlaybackIndex !== -1) {
  lines.splice(resolvePlaybackIndex + 1, 0, 
    '      setEpisodeEnded(false);',
    '      setCreditsAutoplayCountdown(null);',
    '      setAutoplayCountdown(null);',
    '      setPlaybackClock({ current: 0, duration: 0, playing: false });',
    '      setSourceValidated(false);',
    '      sourceValidatedRef.current = false;'
  );
  fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
  console.log('Added state resets to resolvePlayback');
}
