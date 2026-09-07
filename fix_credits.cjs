const fs = require('fs');
let lines = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8').split('\n');

const creditsIndex = lines.findIndex(l => l.includes('const creditsWindowActive = isOutroActive || (playbackClock.duration > 0 && playbackClock.duration - playbackClock.current <= 30 && !introDBSegments.some(s => s.segment_type === "outro"));'));

if (creditsIndex !== -1) {
  lines[creditsIndex] = `    const outroSegment = introDBSegments.find(s => s.segment_type === "outro");
    const passedOutroStart = outroSegment && playbackClock.current >= outroSegment.start_sec;
    const creditsWindowActive = isOutroActive || passedOutroStart || (playbackClock.duration > 0 && playbackClock.duration - playbackClock.current <= 30 && !outroSegment);`;
  fs.writeFileSync('src/components/VideoPlayerModal.tsx', lines.join('\n'));
  console.log('VideoPlayerModal credits logic patched');
} else {
  console.log('Could not find credits logic');
}
